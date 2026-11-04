import type { EngineApiRequest } from '@shared/engine/http'
import type { SessionMessage } from '@shared/engine/types'
import type { GatewayEvent } from '@shared/engine/shared'
import { useChat } from './store'
import type { ChatState } from './store'
import { applyEvent, fromHistory, settlePrompt } from './transcript'
import type { Transcript } from './types'

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
  send: (profile: string, draft: ChatDraft) => Promise<void>
  interrupt: (profile: string) => Promise<void>
  answerClarify: (
    profile: string,
    promptId: string,
    answers: Record<string, string | string[]>
  ) => Promise<void>
  setModel: (profile: string, model: { model: string; provider: string }) => Promise<void>
  setReasoning: (profile: string, level: string) => Promise<void>
  uploadImage: (profile: string, image: { dataUrl: string; name: string }) => Promise<ChatImage>
  transcribe: (profile: string, audio: { dataUrl: string; mime: string }) => Promise<string>
  mediaUrl: (profile: string, path: string) => Promise<string>
}

interface ResumeSnapshot {
  running?: boolean
  last_sequence?: number
  inflight?: { assistant?: string } | null
}

export function chatActions(backend: ChatBackend): ChatActions {
  const { update } = useChat.getState()
  const chatOf = (profile: string): ChatState | undefined => useChat.getState().chats[profile]
  const sessionOf = (profile: string): string | null => chatOf(profile)?.sessionId ?? null

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
    ])
    update(profile, {
      sessionId,
      transcript: rebuilt(chatOf(profile)?.transcript ?? null, sessionId, history.messages, resume),
      loading: false,
      error: null
    })
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

  async function configure(profile: string, key: string, value: string): Promise<void> {
    const sessionId = sessionOf(profile)
    if (sessionId)
      await backend.request(profile, 'config.set', { session_id: sessionId, key, value })
  }

  return {
    open: guarded(async (profile, chatId: string | null) => {
      update(profile, { loading: true, error: null })
      const sessionId = chatId ?? (await findChat(profile))
      if (sessionId) await load(profile, sessionId)
      // Opening never creates a chat; the first send does.
      else update(profile, { sessionId: null, transcript: null, loading: false })
    }),

    rebuild: guarded(async (profile) => {
      const sessionId = sessionOf(profile)
      if (sessionId) await load(profile, sessionId)
    }),

    send: guarded(async (profile, draft: ChatDraft) => {
      const text = draft.text.trim()
      if (!text && !draft.images.length) return
      let sessionId = sessionOf(profile)
      if (!sessionId) {
        sessionId = await createChat(profile)
        await load(profile, sessionId)
      }
      const transcript = chatOf(profile)?.transcript ?? fromHistory(sessionId, [], false)
      update(profile, {
        error: null,
        transcript: {
          ...transcript,
          items: [
            ...transcript.items,
            {
              kind: 'user',
              id: `local-${Date.now()}`,
              text,
              images: draft.images.map((image) => image.path)
            }
          ]
        }
      })
      await backend.request(profile, 'prompt.submit', {
        session_id: sessionId,
        text,
        ...(draft.images.length ? { attachments: draft.images } : {})
      })
    }),

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

    setModel: guarded((profile, { model, provider }: { model: string; provider: string }) =>
      configure(profile, 'model', `${model} --provider ${provider}`)
    ),

    setReasoning: guarded((profile, level: string) => configure(profile, 'reasoning', level)),

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
    lastSeq: resume.last_sequence ?? (same ? previous.lastSeq : 0)
  }
}
