import type { EngineApiRequest } from '@shared/engine/http'
import type { SessionMessage } from '@shared/engine/types'
import type { ModelOptionProvider, SessionLiveInfo } from '@shared/engine/gateway-events'
import type { GatewayEvent } from '@shared/engine/shared'
import { useChat } from './store'
import type { ChatInfo, ChatState } from './store'
import { applyEvent, fromHistory, settlePrompt } from './transcript'
import type { ApprovalChoice, Transcript } from './types'

/** The bot's chat is the profile's hidden session with this exact title. */
export const BOT_CHAT_TITLE = 'Bot Chat'
const HISTORY_LIMIT = 120
const TITLE_TAKEN = 'already in use'

export interface ChatBackend {
  request: <T = unknown>(
    profile: string,
    method: string,
    params?: Record<string, unknown>
  ) => Promise<T>
  http: <T = unknown>(request: EngineApiRequest) => Promise<T>
}

export interface ChatImage {
  path: string
  mime: string
}

export interface ChatDraft {
  text: string
  images: ChatImage[]
}

export interface ChatActions {
  open: (profile: string, chatId: string | null) => Promise<void>
  rebuild: (profile: string) => Promise<void>
  /** False when nothing was sent; the caller keeps the draft. */
  send: (profile: string, draft: ChatDraft) => Promise<boolean>
  interrupt: (profile: string) => Promise<void>
  answerClarify: (
    profile: string,
    promptId: string,
    answers: Record<string, string | string[]>
  ) => Promise<void>
  answerApproval: (profile: string, promptId: string, choice: ApprovalChoice) => void
  setModel: (profile: string, model: { model: string; provider: string }) => Promise<void>
  setReasoning: (profile: string, level: string) => Promise<void>
  models: (profile: string) => Promise<ModelOptionProvider[]>
  uploadImage: (profile: string, image: { dataUrl: string; name: string }) => Promise<ChatImage>
  transcribe: (profile: string, audio: { dataUrl: string; mime: string }) => Promise<string>
  mediaUrl: (profile: string, path: string) => Promise<string>
}

interface ResumeSnapshot {
  info?: SessionLiveInfo | null
  replay_epoch?: string
  running?: boolean
  last_sequence?: number
  inflight?: { assistant?: string } | null
}

export function chatActions(backend: ChatBackend): ChatActions {
  const { update } = useChat.getState()
  const chatOf = (profile: string): ChatState | undefined => useChat.getState().chats[profile]
  const sessionOf = (profile: string): string | null => chatOf(profile)?.sessionId ?? null
  // The newest load per profile; an older one that answers later is dropped.
  const loads = new Map<string, number>()
  // The first send's create per profile, so a second quick send joins it.
  const creating = new Map<string, Promise<string>>()

  // A failed call shows on its chat instead of throwing into the view.
  const guarded =
    <A extends unknown[]>(run: (profile: string, ...args: A) => Promise<void>) =>
    async (profile: string, ...args: A): Promise<void> => {
      try {
        await run(profile, ...args)
      } catch (error) {
        update(profile, {
          loading: false,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

  async function findChat(profile: string): Promise<string | null> {
    const { sessions } = await backend.request<{
      sessions: Array<{ id: string; resolved_id?: string | null }>
    }>(profile, 'session.list', { title: BOT_CHAT_TITLE, limit: 200, include_hidden: true })
    const row = sessions[0]
    return row ? row.resolved_id || row.id : null
  }

  async function load(profile: string, sessionId: string): Promise<void> {
    const token = (loads.get(profile) ?? 0) + 1
    loads.set(profile, token)
    // Events that land while the history is on its way are kept and replayed over it.
    update(profile, { pending: [] })
    const query = new URLSearchParams({
      profile,
      limit: String(HISTORY_LIMIT),
      order: 'latest',
      include_compacted: 'true'
    })
    const [history, resume] = await Promise.all([
      backend.http<{ messages: SessionMessage[] }>({
        path: `/api/sessions/${encodeURIComponent(sessionId)}/messages?${query}`,
        profile
      }),
      backend.request<ResumeSnapshot>(profile, 'session.resume', {
        session_id: sessionId,
        defer_history: true,
        omit_messages: true
      })
    ]).catch((error: unknown) => {
      // A failed reload stops buffering; the next reload starts a fresh buffer.
      if (loads.get(profile) === token) update(profile, { pending: null })
      throw error
    })
    if (loads.get(profile) !== token) return
    const current = chatOf(profile)
    const fresh = rebuilt(current?.transcript ?? null, sessionId, history.messages, resume)
    update(profile, {
      sessionId,
      transcript: (current?.pending ?? []).reduce(applyEvent, fresh),
      pending: null,
      info: infoOf(resume.info, current?.info),
      loading: false,
      error: null
    })
  }

  function startChat(profile: string): Promise<string> {
    const started =
      creating.get(profile) ??
      createChat(profile)
        .then(async (sessionId) => {
          update(profile, { sessionId })
          await load(profile, sessionId)
          return sessionId
        })
        .finally(() => creating.delete(profile))
    creating.set(profile, started)
    return started
  }

  async function createChat(profile: string): Promise<string> {
    const { session_id: created } = await backend.request<{ session_id: string }>(
      profile,
      'session.create',
      { title: BOT_CHAT_TITLE, hidden: true, follow_profile_config: true }
    )
    try {
      await backend.request(profile, 'session.title', {
        session_id: created,
        title: BOT_CHAT_TITLE
      })
      return created
    } catch (error) {
      // Another client created the Bot Chat first: use that one.
      const winner = error instanceof Error && error.message.includes(TITLE_TAKEN)
      const existing = winner ? await findChat(profile) : null
      if (!existing) throw error
      return existing
    }
  }

  // Before the first send there is no session to configure; the composer disables the chips.
  async function configure(profile: string, key: string, value: string): Promise<boolean> {
    const sessionId = sessionOf(profile)
    if (!sessionId) return false
    await backend.request(profile, 'config.set', { session_id: sessionId, key, value })
    return true
  }

  return {
    open: guarded(async (profile, chatId: string | null) => {
      update(profile, { loading: true, error: null })
      const sessionId = chatId ?? (await findChat(profile))
      // Known before the history loads, so cards the snapshot delivers find this chat.
      if (sessionId) {
        update(profile, { sessionId })
        await load(profile, sessionId)
      }
      // Opening never creates a chat; the first send does.
      else update(profile, { sessionId: null, transcript: null, loading: false })
    }),

    rebuild: guarded(async (profile) => {
      const sessionId = sessionOf(profile)
      if (sessionId) await load(profile, sessionId)
    }),

    send: async (profile, draft) => {
      const text = draft.text.trim()
      if (!text && !draft.images.length) return false
      const local = `local-${Date.now()}-${Math.random()}`
      try {
        const sessionId = sessionOf(profile) ?? (await startChat(profile))
        const transcript = chatOf(profile)?.transcript ?? fromHistory(sessionId, [], false)
        const images = draft.images.map((image) => image.path)
        update(profile, {
          error: null,
          transcript: {
            ...transcript,
            items: [...transcript.items, { kind: 'user', id: local, text, images }]
          }
        })
        await backend.request(profile, 'prompt.submit', {
          session_id: sessionId,
          text,
          ...(draft.images.length ? { attachments: draft.images } : {})
        })
        return true
      } catch (error) {
        // The composer gets the draft back, so the bubble for it goes.
        const transcript = chatOf(profile)?.transcript ?? null
        update(profile, {
          error: error instanceof Error ? error.message : String(error),
          transcript: transcript && {
            ...transcript,
            items: transcript.items.filter((item) => item.id !== local)
          }
        })
        return false
      }
    },

    interrupt: guarded(async (profile) => {
      const sessionId = sessionOf(profile)
      if (sessionId) await backend.request(profile, 'session.interrupt', { session_id: sessionId })
    }),

    answerClarify: guarded(async (profile, promptId: string, answers) => {
      const prompt = chatOf(profile)?.transcript?.prompts.find((item) => item.id === promptId)
      if (prompt?.kind !== 'clarify') return
      // In order: the last lock completes the batch, so every earlier one must already be in.
      for (const question of prompt.questions) {
        const answer = answers[question.qid] ?? ''
        await backend.request(profile, 'clarify.lock', {
          request_id: promptId,
          question_id: question.qid,
          answer: Array.isArray(answer) ? JSON.stringify(answer) : answer
        })
      }
      const transcript = chatOf(profile)?.transcript
      if (transcript) update(profile, { transcript: settlePrompt(transcript, promptId) })
    }),

    answerApproval: (profile, promptId, choice) => {
      const transcript = chatOf(profile)?.transcript
      const prompt = transcript?.prompts.find((item) => item.id === promptId)
      if (!transcript || prompt?.kind !== 'approval') return
      prompt.respond(choice)
      update(profile, { transcript: settlePrompt(transcript, promptId) })
    },

    setModel: guarded(async (profile, { model, provider }: { model: string; provider: string }) => {
      if (await configure(profile, 'model', `${model} --provider ${provider}`))
        update(profile, { info: { ...chatOf(profile)!.info, model, provider } })
    }),

    setReasoning: guarded(async (profile, level: string) => {
      if (await configure(profile, 'reasoning', level))
        update(profile, { info: { ...chatOf(profile)!.info, reasoning: level } })
    }),

    models: async (profile) => {
      const query = new URLSearchParams({ explicit_only: '1', profile })
      const { providers } = await backend.http<{ providers: ModelOptionProvider[] }>({
        path: `/api/model/options?${query}`,
        profile
      })
      return providers
    },

    uploadImage: async (profile, { dataUrl, name }) => {
      const { path, mime_type: mime } = await backend.http<{ path: string; mime_type: string }>({
        path: `/api/chat/image-upload?profile=${encodeURIComponent(profile)}`,
        method: 'POST',
        body: { data_url: dataUrl, filename: name },
        profile
      })
      return { path, mime }
    },

    transcribe: async (profile, { dataUrl, mime }) => {
      const { transcript } = await backend.http<{ transcript: string }>({
        path: `/api/audio/transcribe?profile=${encodeURIComponent(profile)}`,
        method: 'POST',
        body: { data_url: dataUrl, mime_type: mime },
        profile
      })
      return transcript
    },

    mediaUrl: async (profile, path) => {
      const query = new URLSearchParams({ path, profile })
      const { data_url: dataUrl } = await backend.http<{ data_url: string }>({
        path: `/api/media?${query}`,
        profile
      })
      return dataUrl
    }
  }
}

// A rebuild of the same session keeps its open cards; the stored history plus the turn still in
// flight replace the items. The snapshot's sequence is authoritative: a new replay epoch restarts it.
function rebuilt(
  previous: Transcript | null,
  sessionId: string,
  messages: SessionMessage[],
  resume: ResumeSnapshot
): Transcript {
  let transcript = fromHistory(sessionId, messages, resume.running === true)
  const inflight = resume.running ? resume.inflight?.assistant : null
  if (inflight) {
    transcript = [
      { type: 'message.start' },
      { type: 'message.delta', payload: { text: inflight } }
    ].reduce((current, event) => applyEvent(current, event as GatewayEvent), transcript)
  }
  const same = previous?.sessionId === sessionId
  return {
    ...transcript,
    prompts: same ? previous.prompts : [],
    lastSeq: resume.last_sequence ?? (same ? previous.lastSeq : 0),
    epoch: resume.replay_epoch ?? (same ? previous.epoch : null)
  }
}

/** The live session info over what the chat showed before; absent fields keep their value. */
export function infoOf(
  live: Partial<SessionLiveInfo> | null | undefined,
  previous?: ChatInfo
): ChatInfo {
  const pick = (value: unknown, fallback: string | null | undefined): string | null =>
    typeof value === 'string' && value ? value : (fallback ?? null)
  return {
    model: pick(live?.model, previous?.model),
    provider: pick(live?.provider, previous?.provider),
    reasoning: pick(live?.reasoning_effort, previous?.reasoning)
  }
}
