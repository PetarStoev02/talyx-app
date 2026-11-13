import type { SessionMessage } from '@shared/engine/types'
import type { ModelOptionProvider, SessionLiveInfo } from '@shared/engine/gateway-events'
import type { GatewayEvent } from '@shared/engine/shared'
import type { TranslationKey } from '@shared/lib/i18n'
import { failureOf } from '@shared/lib/problem'
import { useChat } from './store'
import type { ChatInfo, ChatState } from './store'
import { applyEvent, fromHistory, settlePrompt, withFailedTurns, withoutTurn } from './transcript'
import { SENDING_ID } from './turns'
import type { ApprovalChoice, ChatItem, Transcript } from './types'

const HISTORY_LIMIT = 120

/** A transcript image the engine no longer has on disk. */
export class MediaGoneError extends Error {
  constructor(readonly path: string) {
    super('The engine no longer has this file')
    this.name = 'MediaGoneError'
  }
}

export interface ChatBackend {
  /** The bot's chat, or null when it has none yet. */
  findChat: (profile: string) => Promise<string | null>
  /** A new chat for the bot; when another client made one first, that one. */
  createChat: (profile: string) => Promise<string>
  /** The chat's stored messages, compacted ones too: the newest `limit`, or all of them for null. */
  history: (profile: string, chatId: string, limit: number | null) => Promise<SessionMessage[]>
  /** The chat's newest `limit` stored messages, without those compacted away. */
  newestMessages: (profile: string, chatId: string, limit: number) => Promise<SessionMessage[]>
  /** The chat's live state: its info, and the turn still in flight. */
  resume: (profile: string, chatId: string) => Promise<ResumeSnapshot>
  /** Sends the draft (its text already trimmed) on the chat. */
  submit: (profile: string, chatId: string, draft: ChatDraft) => Promise<void>
  interrupt: (profile: string, chatId: string) => Promise<void>
  setModel: (
    profile: string,
    chatId: string,
    model: { model: string; provider: string }
  ) => Promise<void>
  setReasoning: (profile: string, chatId: string, level: string) => Promise<void>
  /** Answers one question of a clarify card. */
  answerQuestion: (
    profile: string,
    promptId: string,
    question: { id: string; answer: string | string[] }
  ) => Promise<void>
  /** The models a profile can pick. */
  models: (profile: string) => Promise<ModelOptionProvider[]>
  uploadImage: (profile: string, image: { dataUrl: string; name: string }) => Promise<ChatImage>
  /** The words in a voice recording. */
  transcribe: (profile: string, audio: { dataUrl: string; mime: string }) => Promise<string>
  /** An image of the transcript as a data URL; MediaGoneError when the engine no longer has it. */
  mediaUrl: (profile: string, path: string) => Promise<string>
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
  // The id of your message this one is sent in place of: the engine cuts the chat back to before
  // it (when it stored it), and its turn goes, so the new answer replaces the old.
  replaces?: string
}

export interface ChatActions {
  open: (profile: string, chatId: string | null) => Promise<void>
  /** The bot's newest replies as text, oldest first; none when it has no chat yet. */
  recent: (profile: string, limit: number) => Promise<string[]>
  rebuild: (profile: string) => Promise<void>
  /** Loads every stored message, not only the newest, and keeps doing so on later reloads. */
  loadWhole: (profile: string) => Promise<void>
  /** Back to the newest messages only, from the next reload on (the search closed). */
  keepNewest: (profile: string) => void
  /** False when nothing was sent; the caller keeps the draft. */
  send: (profile: string, draft: ChatDraft) => Promise<boolean>
  /**
   * The composer's send. Sends now when the bot is idle; while it answers, the message waits and
   * goes when the answer ends (a Stop ends it too), so it never cuts into that answer. False when
   * nothing was sent; the caller keeps the draft.
   */
  queue: (profile: string, draft: ChatDraft) => Promise<boolean>
  /**
   * Asks again for the answer to your last message, in its place: the old answer, or the failure,
   * goes and a new turn answers the same words. False when nothing went (the bot is answering,
   * or the engine refused): the caller puts the words back in the composer.
   */
  regenerate: (profile: string, asked: { id: string; text: string }) => Promise<boolean>
  /** Takes a waiting message back before it is sent. */
  unqueue: (profile: string, id: string) => void
  /** Stops the running answer so this waiting message goes next, ahead of the others. */
  sendNow: (profile: string, id: string) => Promise<void>
  /** The bot's answer ended: reloads the chat, then the oldest waiting message goes. */
  turnEnded: (profile: string) => Promise<void>
  /**
   * The engine cut the chat back (another client, or this one asking for an answer again). Ends
   * the turn like turnEnded, except while this window asks again: the new turn's end reloads then.
   */
  rewound: (profile: string) => Promise<void>
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

export interface ResumeSnapshot {
  info?: SessionLiveInfo | null
  replay_epoch?: string
  running?: boolean
  last_sequence?: number
  inflight?: { assistant?: string; user?: string; error?: string } | null
}

export function chatActions(backend: ChatBackend): ChatActions {
  const { update } = useChat.getState()
  const chatOf = (profile: string): ChatState | undefined => useChat.getState().chats[profile]
  const sessionOf = (profile: string): string | null => chatOf(profile)?.sessionId ?? null
  // The newest load per profile; an older one that answers later is dropped.
  const loads = new Map<string, number>()
  // The first send's create per profile, so a second quick send joins it.
  const creating = new Map<string, Promise<string>>()
  const modelLists = new Map<string, Promise<ModelOptionProvider[]>>()
  // The model and reasoning picks per profile, one after another; a send waits for them to settle.
  const configuring = new Map<string, Promise<void>>()
  // Profiles whose composer message is out and its answer not yet ended.
  const out = new Set<string>()
  // The reload of an ended turn under way per profile.
  const ending = new Map<string, Promise<void>>()
  // Profiles whose answer is being asked again: the engine reports its own cut of the old turn
  // before the new message is stored, and a reload then would show neither.
  const rewinding = new Set<string>()

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

  async function load(profile: string, sessionId: string): Promise<void> {
    const token = (loads.get(profile) ?? 0) + 1
    loads.set(profile, token)
    // Events that land while the history is on its way are kept and replayed over it.
    update(profile, { pending: [] })
    const [messages, resume] = await Promise.all([
      backend.history(profile, sessionId, chatOf(profile)?.whole ? null : HISTORY_LIMIT),
      backend.resume(profile, sessionId)
    ]).catch((error: unknown) => {
      // A failed reload stops buffering; the next reload starts a fresh buffer.
      if (loads.get(profile) === token) update(profile, { pending: null })
      throw error
    })
    if (loads.get(profile) !== token) return
    const current = chatOf(profile)
    const fresh = rebuilt(current?.transcript ?? null, sessionId, messages, resume)
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
      backend
        .createChat(profile)
        .then(async (sessionId) => {
          update(profile, { sessionId })
          await load(profile, sessionId)
          return sessionId
        })
        .finally(() => creating.delete(profile))
    creating.set(profile, started)
    return started
  }

  // A pick before the first send starts the Bot Chat, so the choice holds for that send.
  function configure(profile: string, apply: (sessionId: string) => Promise<void>): Promise<void> {
    const picked = (configuring.get(profile) ?? Promise.resolve()).then(async () => {
      await apply(sessionOf(profile) ?? (await startChat(profile)))
    })
    // A failed pick shows on the chat (guarded); the picks and sends after it still go.
    configuring.set(
      profile,
      picked.catch(() => undefined)
    )
    return picked
  }

  const rebuild = guarded('chat.errorLoad', async (profile) => {
    const sessionId = sessionOf(profile)
    if (sessionId) await load(profile, sessionId)
  })

  const interrupt = guarded('chat.errorStop', async (profile) => {
    const sessionId = sessionOf(profile)
    if (sessionId) await backend.interrupt(profile, sessionId)
  })

  async function send(profile: string, draft: ChatDraft): Promise<boolean> {
    const text = draft.text.trim()
    if (!text && !draft.images.length) return false
    const local = `${SENDING_ID}${Date.now()}-${Math.random()}`
    // The chat before a send in place of a message, for when the send fails.
    let replaced: Transcript | null = null
    try {
      const sessionId = sessionOf(profile) ?? (await startChat(profile))
      const shown = chatOf(profile)?.transcript ?? fromHistory(sessionId, [], false)
      if (draft.replaces) replaced = shown
      const transcript = draft.replaces ? withoutTurn(shown, draft.replaces) : shown
      const images = draft.images.map((image) => image.path)
      update(profile, {
        error: null,
        transcript: {
          ...transcript,
          items: [...transcript.items, { kind: 'user', id: local, text, images }]
        }
      })
      // A pick made just before the send applies to it.
      await configuring.get(profile)
      await backend.submit(profile, sessionId, { ...draft, text })
      return true
    } catch (error) {
      const failure = failureOf('chat.errorSend', error)
      if (replaced) await reloadReplaced(profile, replaced)
      // The composer gets the draft back, so the bubble for it goes.
      else {
        const transcript = chatOf(profile)?.transcript ?? null
        update(profile, {
          transcript: transcript && {
            ...transcript,
            items: transcript.items.filter((item) => item.id !== local)
          }
        })
      }
      update(profile, { error: failure })
      return false
    }
  }

  // The engine may have cut the old turn before it refused the new one: its history says what is
  // left. The chat as it was keeps a failed turn the engine never stored.
  async function reloadReplaced(profile: string, replaced: Transcript): Promise<void> {
    update(profile, { transcript: replaced })
    await load(profile, replaced.sessionId).catch(() => undefined)
  }

  // A message is out from its send until its answer ends. Until the engine starts that answer
  // the chat does not show as running, so this, not `running`, keeps the next one from cutting in.
  function busy(profile: string): boolean {
    return out.has(profile) || chatOf(profile)?.transcript?.running === true
  }

  async function submit(profile: string, draft: ChatDraft): Promise<boolean> {
    out.add(profile)
    const sent = await send(profile, draft)
    if (!sent) out.delete(profile)
    return sent
  }

  // The stored history then carries what live events do not: rows from other clients and bots.
  // A reconnect and a replayed reply can both end the same turn: they share this one reload, and
  // it is over before the next message goes, so that message's own end is never folded into it.
  function reloadEnded(profile: string): Promise<void> {
    const reload =
      ending.get(profile) ??
      rebuild(profile)
        .then(() => void out.delete(profile))
        .finally(() => ending.delete(profile))
    ending.set(profile, reload)
    return reload
  }

  async function turnEnded(profile: string): Promise<void> {
    await reloadEnded(profile)
    // The next message goes after the reload, so the reload neither drops its bubble nor its
    // error. A second end of the same turn finds it out already (submit marks it at once).
    await sendWaiting(profile)
  }

  async function sendWaiting(profile: string): Promise<void> {
    const [next, ...rest] = chatOf(profile)?.waiting ?? []
    if (!next || busy(profile)) return
    update(profile, { waiting: rest })
    // A failed send keeps its message first in line; the error says why, the next message retries.
    // Sent queued: if a turn this window has not seen start is live, it waits instead of cutting in.
    if (!(await submit(profile, { ...next.draft, whenBusy: 'queue' })))
      update(profile, { waiting: [next, ...(chatOf(profile)?.waiting ?? [])] })
  }

  return {
    open: guarded('chat.errorLoad', async (profile, chatId: string | null) => {
      // Opened only while the chat has no session: nothing of a bot by this name is out.
      out.delete(profile)
      update(profile, { loading: true, error: null })
      const sessionId = chatId ?? (await backend.findChat(profile))
      // Known before the history loads, so cards the snapshot delivers find this chat.
      if (sessionId) {
        update(profile, { sessionId })
        await load(profile, sessionId)
      }
      // Opening never creates a chat; the first send does.
      else update(profile, { sessionId: null, transcript: null, loading: false })
    }),

    recent: async (profile, limit) => {
      const sessionId = sessionOf(profile) ?? (await backend.findChat(profile))
      if (!sessionId) return []
      const messages = await backend.newestMessages(profile, sessionId, limit)
      return fromHistory(sessionId, messages, false).items.flatMap((item) =>
        item.kind === 'bot' ? [item.text] : []
      )
    },

    rebuild,

    loadWhole: guarded('chat.errorLoad', async (profile) => {
      if (chatOf(profile)?.whole) return
      // Set before the chat exists too, so the load that opens or creates it is whole.
      update(profile, { whole: true })
      const sessionId = sessionOf(profile)
      if (!sessionId) return
      try {
        await load(profile, sessionId)
      } catch (error) {
        update(profile, { whole: false })
        throw error
      }
    }),

    keepNewest: (profile) => update(profile, { whole: false }),

    send,

    queue: async (profile, draft) => {
      const waiting = chatOf(profile)?.waiting ?? []
      if (!busy(profile) && !waiting.length) return submit(profile, draft)
      const message = { id: `waiting-${Date.now()}-${Math.random()}`, draft }
      update(profile, { waiting: [...waiting, message] })
      void sendWaiting(profile)
      return true
    },

    regenerate: async (profile, asked) => {
      if (busy(profile)) return false
      rewinding.add(profile)
      try {
        return await submit(profile, { text: asked.text, images: [], replaces: asked.id })
      } finally {
        rewinding.delete(profile)
      }
    },

    unqueue: (profile, id) => {
      const waiting = chatOf(profile)?.waiting ?? []
      update(profile, { waiting: waiting.filter((message) => message.id !== id) })
    },

    sendNow: async (profile, id) => {
      const waiting = chatOf(profile)?.waiting ?? []
      const message = waiting.find((item) => item.id === id)
      if (!message) return
      update(profile, { waiting: [message, ...waiting.filter((item) => item !== message)] })
      // The stopped answer ends the turn, and turnEnded sends it; an idle chat sends it here.
      if (chatOf(profile)?.transcript?.running) await interrupt(profile)
      else {
        // Idle: whatever was out has ended or never started, so nothing holds this one back.
        out.delete(profile)
        await sendWaiting(profile)
      }
    },

    turnEnded,

    rewound: async (profile) => {
      if (!rewinding.has(profile)) await turnEnded(profile)
    },

    interrupt,

    answerClarify: guarded('chat.errorAnswer', async (profile, promptId: string, answers) => {
      const prompt = chatOf(profile)?.transcript?.prompts.find((item) => item.id === promptId)
      if (prompt?.kind !== 'clarify') return
      // In order: the last lock completes the batch, so every earlier one must already be in.
      for (const question of prompt.questions) {
        const answer = answers[question.qid] ?? ''
        await backend.answerQuestion(profile, promptId, { id: question.qid, answer })
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
        await configure(profile, (sessionId) =>
          backend.setModel(profile, sessionId, { model, provider })
        )
        update(profile, { info: { ...chatOf(profile)!.info, model, provider } })
      }
    ),

    setReasoning: guarded('chat.errorReasoning', async (profile, level: string) => {
      await configure(profile, (sessionId) => backend.setReasoning(profile, sessionId, level))
      update(profile, { info: { ...chatOf(profile)!.info, reasoning: level } })
    }),

    models: (profile) => {
      const loaded = modelLists.get(profile) ?? backend.models(profile)
      modelLists.set(profile, loaded)
      // A failed load is not kept: the next open tries again.
      loaded.catch(() => modelLists.get(profile) === loaded && modelLists.delete(profile))
      return loaded
    },

    forgetModels: () => modelLists.clear(),

    uploadImage: backend.uploadImage,

    transcribe: backend.transcribe,

    mediaUrl: backend.mediaUrl
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
  transcript = withFailedTurns(transcript, same ? previous.failed : [])
  if (!resume.running && resume.inflight?.error)
    transcript = withHeldFailure(transcript, resume.inflight, resume.last_sequence ?? 0)
  return {
    ...transcript,
    prompts: same ? previous.prompts : [],
    lastSeq: resume.last_sequence ?? (same ? previous.lastSeq : 0),
    epoch: resume.replay_epoch ?? (same ? previous.epoch : null)
  }
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
