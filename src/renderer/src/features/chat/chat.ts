import type { EngineApiRequest } from '@shared/engine/http'
import type { CustomEndpoint, SessionMessage } from '@shared/engine/types'
import type { ModelOptionProvider, SessionLiveInfo } from '@shared/engine/gateway-events'
import type { GatewayEvent } from '@shared/engine/shared'
import { BARE_CUSTOM, namedTwinOfBare, sameBaseUrl } from '@shared/engine/endpoints'
import type { TranslationKey } from '@shared/lib/i18n'
import { failureOf } from '@shared/lib/problem'
import { useChat } from './store'
import type { ChatInfo, ChatState } from './store'
import { applyEvent, fromHistory, settlePrompt, withFailedTurns } from './transcript'
import type { ApprovalChoice, ChatItem, Transcript } from './types'

/** The bot's chat is the profile's hidden session with this exact title. */
export const BOT_CHAT_TITLE = 'Bot Chat'
const HISTORY_LIMIT = 120
const TITLE_TAKEN = 'already in use'

/** A transcript image the engine no longer has on disk. */
export class MediaGoneError extends Error {
  constructor(readonly path: string) {
    super('The engine no longer has this file')
    this.name = 'MediaGoneError'
  }
}

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
  // 'queue': when the bot is mid-turn, the message waits for that turn to end instead of
  // redirecting it (the engine's default for a busy chat). Module pages send this way, so one
  // workflow task's message never cuts into another's turn.
  whenBusy?: 'queue'
}

export interface ChatActions {
  open: (profile: string, chatId: string | null) => Promise<void>
  /** The bot's newest replies as text, oldest first; none when it has no chat yet. */
  recent: (profile: string, limit: number) => Promise<string[]>
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
  /** The models a profile can pick, loaded once and shared by every menu until forgetModels. */
  models: (profile: string) => Promise<ModelOptionProvider[]>
  /** Drops the loaded model lists, after providers change. */
  forgetModels: () => void
  uploadImage: (profile: string, image: { dataUrl: string; name: string }) => Promise<ChatImage>
  transcribe: (profile: string, audio: { dataUrl: string; mime: string }) => Promise<string>
  mediaUrl: (profile: string, path: string) => Promise<string>
}

/** What Settings needs of the chat: the model lists, and a way to drop them. */
export type ModelLists = Pick<ChatActions, 'models' | 'forgetModels'>

interface ResumeSnapshot {
  info?: SessionLiveInfo | null
  replay_epoch?: string
  running?: boolean
  last_sequence?: number
  inflight?: { assistant?: string; user?: string; error?: string } | null
  // The message waiting for the running turn to end, as the engine holds it.
  queued?: { user: string } | null
}

// How many of the latest stored items a waiting message is looked for in after a reload.
const RECENT_STORED = 12

export function chatActions(backend: ChatBackend): ChatActions {
  const { update } = useChat.getState()
  const chatOf = (profile: string): ChatState | undefined => useChat.getState().chats[profile]
  const sessionOf = (profile: string): string | null => chatOf(profile)?.sessionId ?? null
  // The newest load per profile; an older one that answers later is dropped.
  const loads = new Map<string, number>()
  // The first send's create per profile, so a second quick send joins it.
  const creating = new Map<string, Promise<string>>()
  const modelLists = new Map<string, Promise<ModelOptionProvider[]>>()

  // A failed call shows on its chat, named by what it was, instead of throwing into the view.
  const guarded =
    <A extends unknown[]>(
      failed: TranslationKey,
      run: (profile: string, ...args: A) => Promise<void>
    ) =>
    async (profile: string, ...args: A): Promise<void> => {
      try {
        await run(profile, ...args)
      } catch (error) {
        update(profile, { loading: false, error: failureOf(failed, error) })
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
    open: guarded('chat.errorLoad', async (profile, chatId: string | null) => {
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

    recent: async (profile, limit) => {
      const sessionId = sessionOf(profile) ?? (await findChat(profile))
      if (!sessionId) return []
      const query = new URLSearchParams({ profile, limit: String(limit), order: 'latest' })
      const { messages } = await backend.http<{ messages: SessionMessage[] }>({
        path: `/api/sessions/${encodeURIComponent(sessionId)}/messages?${query}`,
        profile
      })
      return fromHistory(sessionId, messages, false).items.flatMap((item) =>
        item.kind === 'bot' ? [item.text] : []
      )
    },

    rebuild: guarded('chat.errorLoad', async (profile) => {
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
        const sent: ChatItem = { kind: 'user', id: local, text, images }
        // Sent while the bot answers: it waits under the answer instead of splitting it.
        const waits = draft.whenBusy === 'queue' && transcript.running
        update(profile, {
          error: null,
          transcript: waits
            ? { ...transcript, queued: [...transcript.queued, sent] }
            : { ...transcript, items: [...transcript.items, sent] }
        })
        await backend.request(profile, 'prompt.submit', {
          session_id: sessionId,
          text,
          ...(draft.images.length ? { attachments: draft.images } : {}),
          ...(draft.whenBusy === 'queue' ? { queued: true } : {})
        })
        return true
      } catch (error) {
        // The composer gets the draft back, so the bubble for it goes.
        const transcript = chatOf(profile)?.transcript ?? null
        update(profile, {
          error: failureOf('chat.errorSend', error),
          transcript: transcript && {
            ...transcript,
            items: transcript.items.filter((item) => item.id !== local),
            queued: transcript.queued.filter((item) => item.id !== local)
          }
        })
        return false
      }
    },

    interrupt: guarded('chat.errorStop', async (profile) => {
      const sessionId = sessionOf(profile)
      if (sessionId) await backend.request(profile, 'session.interrupt', { session_id: sessionId })
    }),

    answerClarify: guarded('chat.errorAnswer', async (profile, promptId: string, answers) => {
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

    setModel: guarded(
      'chat.errorModel',
      async (profile, { model, provider }: { model: string; provider: string }) => {
        if (await configure(profile, 'model', `${model} --provider ${provider}`))
          update(profile, { info: { ...chatOf(profile)!.info, model, provider } })
      }
    ),

    setReasoning: guarded('chat.errorReasoning', async (profile, level: string) => {
      if (await configure(profile, 'reasoning', level))
        update(profile, { info: { ...chatOf(profile)!.info, reasoning: level } })
    }),

    models: (profile) => {
      const loaded = modelLists.get(profile) ?? loadModels(backend, profile)
      modelLists.set(profile, loaded)
      // A failed load is not kept: the next open tries again.
      loaded.catch(() => modelLists.get(profile) === loaded && modelLists.delete(profile))
      return loaded
    },

    forgetModels: () => modelLists.clear(),

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
      // Null when the engine no longer has the file; the chat then shows its name.
      const media = await backend.http<{ data_url: string } | null>({
        path: `/api/media?${query}`,
        profile
      })
      if (!media) throw new MediaGoneError(path)
      return media.data_url
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
  const same = previous?.sessionId === sessionId
  const waiting = stillQueued(transcript, same ? previous.queued : [], resume)
  // The running turn answers a message that waited here and history does not hold yet: it shows
  // above the reply, not under it.
  const asked = resume.running ? resume.inflight?.user?.trim() : null
  const answered = waiting.find((item) => item.kind === 'user' && item.text === asked)
  if (answered) transcript = { ...transcript, items: [...transcript.items, answered] }
  const inflight = resume.running ? resume.inflight?.assistant : null
  if (inflight) {
    transcript = [
      { type: 'message.start' },
      { type: 'message.delta', payload: { text: inflight } }
    ].reduce((current, event) => applyEvent(current, event as GatewayEvent), transcript)
  }
  transcript = withFailedTurns(transcript, same ? previous.failed : [])
  if (!resume.running && resume.inflight?.error)
    transcript = withHeldFailure(transcript, resume.inflight, resume.last_sequence ?? 0)
  return {
    ...transcript,
    queued: waiting.filter((item) => item !== answered),
    prompts: same ? previous.prompts : [],
    lastSeq: resume.last_sequence ?? (same ? previous.lastSeq : 0),
    epoch: resume.replay_epoch ?? (same ? previous.epoch : null)
  }
}

/**
 * The messages still waiting after a reload: the ones this window queued that history does not
 * show yet, and the one the engine holds that this window never saw (sent from another client, or
 * before a reconnect).
 */
function stillQueued(
  transcript: Transcript,
  queued: ChatItem[],
  resume: ResumeSnapshot
): ChatItem[] {
  // ponytail: matched by text against the latest stored messages; two equal messages in a row can
  // drop the second from the wait list early. Match on an id if the engine starts sending one.
  const recent = new Set(
    transcript.items
      .slice(-RECENT_STORED)
      .flatMap((item) => (item.kind === 'user' ? [item.text] : []))
  )
  const waiting = queued.filter((item) => item.kind === 'user' && !recent.has(item.text))
  const held = resume.queued?.user?.trim()
  if (!held || waiting.some((item) => item.kind === 'user' && item.text === held)) return waiting
  return [...waiting, { kind: 'user', id: `queued-${held}`, text: held, images: [] }]
}

/**
 * A failed turn the engine holds for a client that missed its frame, until the next turn starts:
 * what was sent, what the bot wrote and why it failed. A chat that saw the frame already has it.
 */
function withHeldFailure(
  transcript: Transcript,
  turn: NonNullable<ResumeSnapshot['inflight']>,
  seq: number
): Transcript {
  const last = transcript.items.at(-1)
  if (last?.kind === 'bot' && last.error !== null) return transcript
  // A message the engine did store is the last item: the failure follows it.
  const sent = turn.user?.trim() ?? ''
  const stored = last?.kind === 'user' && last.text === sent
  const asked: ChatItem[] =
    sent && !stored ? [{ kind: 'user', id: `failed-${seq}-user`, text: sent, images: [] }] : []
  const reply: ChatItem = {
    kind: 'bot',
    id: `failed-${seq}`,
    text: turn.assistant ?? '',
    streaming: false,
    error: turn.error ?? '',
    stopped: false,
    sender: null
  }
  return withFailedTurns(transcript, [{ after: last?.id ?? null, items: [...asked, reply] }])
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

async function loadModels(backend: ChatBackend, profile: string): Promise<ModelOptionProvider[]> {
  const query = new URLSearchParams({ explicit_only: '1', profile })
  const [{ providers }, { endpoints }] = await Promise.all([
    backend.http<{ providers: ModelOptionProvider[] }>({
      path: `/api/model/options?${query}`,
      profile
    }),
    backend
      .http<{ endpoints?: CustomEndpoint[] }>({
        path: `/api/providers/custom-endpoints?${new URLSearchParams({ profile })}`,
        profile
      })
      // The saved lists only narrow the picker: without them it shows every model offered.
      .catch(() => ({ endpoints: [] }))
  ])
  return withoutBareTwin(providers, endpoints ?? []).map((provider) =>
    withSavedModels(provider, endpoints ?? [])
  )
}

/**
 * Talyx keeps its bare custom endpoint as a named one too (see keepBareEndpoint), which would list
 * the same URL twice. The bare row goes and the named row stands for it, so a bot still on the
 * bare provider shows its model as selected there.
 */
function withoutBareTwin(
  providers: ModelOptionProvider[],
  endpoints: CustomEndpoint[]
): ModelOptionProvider[] {
  const twin = namedTwinOfBare(endpoints)
  if (!twin || !providers.some((provider) => provider.slug === twin.id)) return providers
  return providers.flatMap((provider) => {
    if (provider.slug === BARE_CUSTOM) return []
    if (provider.slug !== twin.id) return [provider]
    return [{ ...provider, aliases: [...(provider.aliases ?? []), BARE_CUSTOM] }]
  })
}

/**
 * A custom endpoint offers the models saved on it. A router that also lists every model behind it
 * would otherwise fill the picker with routes that skip its fallback.
 */
function withSavedModels(
  provider: ModelOptionProvider,
  endpoints: CustomEndpoint[]
): ModelOptionProvider {
  const url = provider.is_user_defined ? (provider.api_url ?? '') : ''
  const endpoint = url && endpoints.find((item) => sameBaseUrl(item.base_url, url))
  return endpoint && endpoint.models.length > 0
    ? { ...provider, models: endpoint.models }
    : provider
}
