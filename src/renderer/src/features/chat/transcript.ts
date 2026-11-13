import type { GatewayEvent } from '@shared/engine/shared'
import type { SessionMessage } from '@shared/engine/types'
import type { ChatItem, ChatPrompt, FailedTurn, StreamCursor, Transcript } from './types'

// A message another bot delivered: `Message from 🤖 <name> (@<handle>): <text>`.
const DELIVERY = /^Message from 🤖 (.+?) \(@([^\s)]+)\):\s*([\s\S]*)$/
// Rows the engine writes into the chat itself (a delivery, a finished job, a model switch): no
// one typed them, so they show as one quiet line.
const NOTICE_KINDS = new Set([
  'internal_notification',
  'model_switch',
  'async_delegation_complete',
  'auto_continue',
  'personality_switch',
  'failed_turn'
])
// A background command the bot ran has finished: the engine's bookkeeping, not news. The bot's
// reply after it says what came of it.
const QUIET_KINDS = new Set(['process_complete'])
const MESSAGE_AGENT = 'message_agent'
// The id prefix of a reply streamed live, before the history reload gives it its stored row id.
const LIVE_ID = 'live-'
// The row the engine stores for a turn that failed after it reached the model.
const FAILED_TURN = 'failed_turn'
// What the engine stores, and the failure it names, for a turn the model gave no answer to.
const EMPTY_REPLY = '(empty)'
const EMPTY_RESPONSE = 'empty_response'
// The engine sends its spinner phrases and its provider waits as thinking text; a wait starts with
// this mark. Its notice has an em dash (from its code point: this repo never spells one), shown as
// a comma like the rest of the app's copy.
const WAIT_MARK = '⏳'
const WAIT_DASH = new RegExp(`\\s*${String.fromCharCode(0x2014)}\\s*`, 'g')
// How the engine's wait names its next attempt, in whole seconds from when it said so.
const RETRY_IN = /retrying in (\d+)s\b/
// Frames that mean the engine is no longer waiting: the turn went on or ended.
const WAIT_ENDS = new Set(['message.delta', 'message.complete', 'tool.start', 'tool.complete'])
const IMAGE_LINE = /^@image:(.+)$/gm
const IMAGE_NOTE = /\[Image attached: ([^\]]+)\]/g
// What the engine writes into a stored user message ahead of the typed text, matched by its fixed
// wording only. Each image note names the image's path; the text after the notes is what was typed.
const ENGINE_IMAGE_NOTES = [
  /^\[The user sent an image~ Here's what I can see:\n[\s\S]*?\]\n\[If you need a closer look, use vision_analyze with image_url: ([^\n]+?) ~\](?:\n\n|$)/,
  /^\[The user sent an image but I couldn't quite see it this time \(>_<\) You can try looking at it yourself with vision_analyze using image_url: ([^\n]+?)\](?:\n\n|$)/,
  /^\[The user sent an image but something went wrong when I tried to look at it~ You can try examining it yourself with vision_analyze using image_url: ([^\n]+?)\](?:\n\n|$)/
]
// A request the engine restates after compacting the context, because it was not finished. The
// engine's header has an em dash, built from its code point since this repo never spells one.
const RESTATED = new RegExp(
  `^\\[STILL IN PROGRESS ${String.fromCharCode(0x2014)} this is the active request, restated after the compaction boundary because it was not finished yet\\. Continue it; do not start over\\.\\]\\n`
)

type Payload = Record<string, unknown>
type ToolItem = Extract<ChatItem, { kind: 'tool' }>
type BotItem = Extract<ChatItem, { kind: 'bot' }>
// Where a stamped delta's text sits in its turn's reply.
type StreamPosition = { turnId: string; segment: number; offset: number }

export function fromHistory(
  sessionId: string,
  messages: SessionMessage[],
  running: boolean
): Transcript {
  const calls = toolCalls(messages)
  const items: ChatItem[] = []
  for (const message of messages) {
    for (const item of historyItem(message, calls))
      if (!isRestatedCopy(item, message, items)) items.push(item)
  }
  return {
    sessionId,
    items,
    prompts: [],
    running,
    lastSeq: 0,
    epoch: null,
    stream: null,
    wait: null,
    failed: []
  }
}

/**
 * The profile behind a sender. A delivery names its sender by @handle, which is the profile's name
 * except for Talyx: the engine gives the default profile its own name as handle.
 */
export function senderProfile(handle: string, managerHandle: string | null): string {
  return handle === managerHandle ? 'default' : handle
}

export function applyEvent(transcript: Transcript, event: GatewayEvent): Transcript {
  const epoch = event.replay_epoch ?? event.replayEpoch
  if (epoch && epoch !== transcript.epoch)
    transcript = { ...transcript, epoch, lastSeq: transcript.epoch ? 0 : transcript.lastSeq }
  if (typeof event.seq === 'number') {
    if (event.seq <= transcript.lastSeq) return transcript
    transcript = { ...transcript, lastSeq: event.seq }
  }
  const payload = (event.payload ?? {}) as Payload
  const next = applyPayload(transcript, event, payload)
  return WAIT_ENDS.has(event.type) && next.wait !== null ? { ...next, wait: null } : next
}

function applyPayload(transcript: Transcript, event: GatewayEvent, payload: Payload): Transcript {
  switch (event.type) {
    case 'message.start':
      return startReply(transcript, payload, String(event.seq ?? ''))
    case 'message.delta':
      return typeof payload.text === 'string' && payload.text
        ? streamText(transcript, payload, payload.text, String(event.seq ?? ''))
        : transcript
    case 'message.complete':
      return completeReply(transcript, payload, String(event.seq ?? ''))
    case 'thinking.delta':
      return typeof payload.text === 'string' ? waitFor(transcript, payload.text) : transcript
    case 'tool.start':
      return startTool(transcript, payload)
    case 'tool.complete':
      return completeTool(transcript, payload)
    case 'session.info':
      return typeof payload.running === 'boolean'
        ? { ...transcript, running: payload.running }
        : transcript
    case 'clarify.settled':
    case 'approval.settled':
      return typeof payload.prompt_id === 'string'
        ? settlePrompt(transcript, payload.prompt_id)
        : transcript
    default:
      return transcript
  }
}

/**
 * Puts failed turns back into a transcript read from history, each after the item it followed. A
 * turn whose place is no longer loaded is dropped, and so is one the engine stored.
 */
export function withFailedTurns(transcript: Transcript, turns: FailedTurn[]): Transcript {
  const items = [...transcript.items]
  const kept: FailedTurn[] = []
  for (const turn of turns) {
    const at = turn.after === null ? 0 : items.findIndex((item) => item.id === turn.after) + 1
    if ((turn.after !== null && at === 0) || storedAt(items, at, turn.items[0])) continue
    items.splice(placeOf(items, at, turn.items[0]), 0, ...turn.items)
    kept.push(turn)
  }
  return { ...transcript, items, failed: [...transcript.failed, ...kept] }
}

// A failed turn no message of yours started answered what came in before it (a delivery the
// reload brought): it goes at the end of that run, before your next message.
function placeOf(items: ChatItem[], at: number, first: ChatItem | undefined): number {
  if (first?.kind === 'user') return at
  const next = items.findIndex((item, index) => index >= at && item.kind === 'user')
  return next < 0 ? items.length : next
}

/**
 * The engine stores a turn that failed after it reached the model: its message, then before the
 * next message a failed reply. A carried turn that is only a reply already follows its stored
 * message. The same words sent again and answered are another turn.
 * Matched by place and words only: a resend of the same words that also fails and is stored hides
 * the earlier failure the engine did not store. Matching on submission ids would tell them apart.
 */
function storedAt(items: ChatItem[], at: number, first: ChatItem | undefined): boolean {
  let from = at
  if (first?.kind === 'user') {
    const next = items[at]
    if (next?.kind !== 'user' || next.text !== first.text) return false
    from = at + 1
  }
  const end = items.findIndex((item, index) => index >= from && item.kind === 'user')
  return items
    .slice(from, end < 0 ? undefined : end)
    .some((item) => item.kind === 'bot' && item.error !== null)
}

/**
 * The chat without your message and the turn that answered it, the last turn: what shows while it
 * is asked again. A failed turn kept for that message goes with it.
 */
export function withoutTurn(transcript: Transcript, asked: string): Transcript {
  const at = transcript.items.findIndex((item) => item.id === asked)
  if (at < 0) return transcript
  return {
    ...transcript,
    items: transcript.items.slice(0, at),
    failed: transcript.failed.filter((turn) => !turn.items.some((item) => item.id === asked))
  }
}

export function addPrompt(transcript: Transcript, prompt: ChatPrompt): Transcript {
  return {
    ...transcript,
    prompts: [...transcript.prompts.filter((item) => item.id !== prompt.id), prompt]
  }
}

export function settlePrompt(transcript: Transcript, promptId: string): Transcript {
  return { ...transcript, prompts: transcript.prompts.filter((item) => item.id !== promptId) }
}

/** A gap the replay could not cover, or a rewind from another client: reload from history. */
export function needsRebuild(event: GatewayEvent): boolean {
  const payload = (event.payload ?? {}) as Payload
  return (
    event.type === 'session.replay_gap' ||
    // A canonical-wire event the generated contract does not list.
    ((event.type as string) === 'session.updated' && payload.operation === 'rewind')
  )
}

function historyItem(
  message: SessionMessage,
  calls: Map<string, { name: string; args: Payload }>
): ChatItem[] {
  if (message.display_kind === 'hidden' || QUIET_KINDS.has(message.display_kind ?? '')) return []
  const id = String(message.row_id ?? message.id ?? '')
  const text = messageText(message.display_content ?? message.content)
  if (message.role === 'user') {
    const delivery = DELIVERY.exec(text)
    if (delivery) {
      const [, name, profile, body] = delivery
      return [
        {
          kind: 'bot',
          id,
          text: body,
          streaming: false,
          error: null,
          stopped: false,
          sender: { name, profile }
        }
      ]
    }
    if (message.display_kind && NOTICE_KINDS.has(message.display_kind))
      return [{ kind: 'notice', id, text: noticeText(message, text) }]
    return [userItem(id, text)]
  }
  if (message.role === 'assistant' && message.display_kind === FAILED_TURN) {
    // Its text is a fixed notice; the metadata names what went wrong.
    const reason = parseArgs(message.display_metadata).error
    return [failedReply(id, typeof reason === 'string' && reason ? reason : text)]
  }
  if (message.role === 'assistant')
    return text.trim() && text.trim() !== EMPTY_REPLY
      ? [
          {
            kind: 'bot',
            id,
            text,
            streaming: false,
            error: null,
            // The engine marks the reply a stop cut short, so a reopened chat still says so.
            stopped: parseArgs(message.display_metadata).interrupted === true,
            sender: null
          }
        ]
      : []
  if (message.role === 'tool') {
    const call = calls.get(message.tool_call_id ?? '')
    const name = message.tool_name ?? message.name ?? call?.name ?? 'tool'
    const args = (message.args as Payload | undefined) ?? call?.args ?? {}
    return [{ ...toolItem(id, name, args, message.labels), done: true }]
  }
  return []
}

function noticeText(message: SessionMessage, text: string): string {
  const metadata = parseArgs(message.display_metadata)
  return typeof metadata.display_text === 'string' && metadata.display_text.trim()
    ? metadata.display_text
    : text.split('\n')[0].trim()
}

// A restated request whose original is still in the chat shows once, as first sent.
function isRestatedCopy(item: ChatItem, message: SessionMessage, items: ChatItem[]): boolean {
  if (
    item.kind !== 'user' ||
    !RESTATED.test(messageText(message.display_content ?? message.content))
  )
    return false
  const original = items.filter((earlier) => earlier.kind === 'user').at(-1)
  return original?.kind === 'user' && original.text === item.text
}

function userItem(id: string, stored: string): ChatItem {
  const { typed, notedImages } = withoutEngineText(stored)
  const images = [
    ...notedImages,
    ...[...typed.matchAll(IMAGE_LINE), ...typed.matchAll(IMAGE_NOTE)].map((match) =>
      match[1].trim()
    )
  ]
  const text = typed.replace(IMAGE_LINE, '').replace(IMAGE_NOTE, '').trim()
  return { kind: 'user', id, text, images: [...new Set(images)] }
}

function withoutEngineText(stored: string): { typed: string; notedImages: string[] } {
  let typed = stored.replace(RESTATED, '')
  const notedImages: string[] = []
  for (;;) {
    const note = ENGINE_IMAGE_NOTES.map((shape) => shape.exec(typed)).find(Boolean)
    if (!note) return { typed, notedImages }
    notedImages.push(note[1].trim())
    typed = typed.slice(note[0].length)
  }
}

function toolItem(
  id: string,
  name: string,
  args: Payload,
  labels: unknown
): Omit<ToolItem, 'done'> {
  const label = Array.isArray(labels) ? (labels[0] as { text?: unknown } | undefined)?.text : null
  return {
    kind: 'tool',
    id,
    name,
    label: typeof label === 'string' && label ? label : name,
    seconds: null,
    target: name === MESSAGE_AGENT && typeof args.target === 'string' ? args.target : null
  }
}

// Stored transcripts carry a tool's name and arguments on the assistant row that called it.
function toolCalls(messages: SessionMessage[]): Map<string, { name: string; args: Payload }> {
  const calls = new Map<string, { name: string; args: Payload }>()
  for (const message of messages) {
    if (!Array.isArray(message.tool_calls)) continue
    for (const call of message.tool_calls as Array<{
      id?: string
      function?: { name?: string; arguments?: unknown }
    }>) {
      if (call.id && call.function?.name)
        calls.set(call.id, { name: call.function.name, args: parseArgs(call.function.arguments) })
    }
  }
  return calls
}

function parseArgs(value: unknown): Payload {
  if (value && typeof value === 'object') return value as Payload
  try {
    const parsed: unknown = JSON.parse(String(value))
    return parsed && typeof parsed === 'object' ? (parsed as Payload) : {}
  } catch {
    return {}
  }
}

function messageText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((part: { type?: unknown; text?: unknown }) =>
      part?.type === 'text' && typeof part.text === 'string' ? part.text : ''
    )
    .join('')
}

function lastStreamingReply(transcript: Transcript): number {
  const index = transcript.items.length - 1
  const last = transcript.items[index]
  return last?.kind === 'bot' && last.streaming ? index : -1
}

function failedReply(id: string, error: string): BotItem {
  return { kind: 'bot', id, text: '', streaming: false, error, stopped: false, sender: null }
}

function withStreamingReply(transcript: Transcript, id: string): Transcript {
  if (lastStreamingReply(transcript) >= 0) return transcript
  const reply: BotItem = {
    kind: 'bot',
    id: `${LIVE_ID}${id}`,
    text: '',
    streaming: true,
    error: null,
    stopped: false,
    sender: null
  }
  return { ...transcript, items: [...transcript.items, reply] }
}

function updateReply(transcript: Transcript, change: (reply: BotItem) => BotItem): Transcript {
  const index = lastStreamingReply(transcript)
  const items = [...transcript.items]
  items[index] = change(items[index] as BotItem)
  return { ...transcript, items }
}

function startReply(transcript: Transcript, payload: Payload, id: string): Transcript {
  const turnId = typeof payload.turn_id === 'string' && payload.turn_id ? payload.turn_id : null
  // A re-sent start of the turn already applied is not a new turn: a fresh reply would take its
  // re-sent text as a second copy.
  if (turnId && transcript.stream?.turnId === turnId) return transcript
  return {
    ...withStreamingReply(transcript, id),
    running: true,
    stream: turnId ? { turnId, segment: 0, end: 0 } : null
  }
}

// A stamped delta adds only the text past what its segment already applied; an unstamped one
// (older engines) appends, deduped by seq alone.
function streamText(
  transcript: Transcript,
  payload: Payload,
  text: string,
  id: string
): Transcript {
  const position = streamPosition(payload)
  if (!position) return appendText(transcript, text, id)
  const { stream, unseen } = admitDelta(transcript.stream, position, text)
  const next = { ...transcript, stream }
  return unseen ? appendText(next, unseen, id) : next
}

function streamPosition(payload: Payload): StreamPosition | null {
  const count = (value: unknown): number | null =>
    typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null
  const segment = count(payload.segment)
  if (typeof payload.turn_id !== 'string' || !payload.turn_id || segment === null) return null
  return { turnId: payload.turn_id, segment, offset: count(payload.offset) ?? 0 }
}

// The engine desktop app's rule (segment-identity.ts): a later segment or another turn starts
// fresh, an earlier segment or an applied range is a re-send, an overlap keeps its unseen tail and
// a gap (frames lost) applies whole.
function admitDelta(
  stream: StreamCursor | null,
  position: StreamPosition,
  text: string
): { stream: StreamCursor; unseen: string } {
  const { turnId, segment, offset } = position
  const end = offset + text.length
  if (!stream || stream.turnId !== turnId || segment > stream.segment)
    return { stream: { turnId, segment, end }, unseen: text }
  if (segment < stream.segment || end <= stream.end) return { stream, unseen: '' }
  return { stream: { ...stream, end }, unseen: text.slice(Math.max(0, stream.end - offset)) }
}

function appendText(transcript: Transcript, text: string, id: string): Transcript {
  return updateReply(withStreamingReply(transcript, id), (reply) => ({
    ...reply,
    text: reply.text + text
  }))
}

function completeReply(transcript: Transcript, payload: Payload, id: string): Transcript {
  const failed = payload.status === 'error'
  const text = typeof payload.text === 'string' ? payload.text : ''
  if (lastStreamingReply(transcript) < 0 && !text && !failed)
    return { ...transcript, running: false }
  // A failed turn's text is the engine's account of the failure unless it says the text is a
  // partial answer; the account shows as the error, not as a reply. A stopped turn, or one the
  // model gave no answer to, has only the engine's account: the chat says what happened instead.
  const account =
    failed || payload.status === 'interrupted' || payload.failure_reason === EMPTY_RESPONSE
  const answer = account && payload.partial !== true ? '' : text
  const done = updateReply(withStreamingReply(transcript, id), (reply) => ({
    ...reply,
    // The final text covers the whole turn; it fills the reply only when nothing streamed into it.
    text: reply.text || answer,
    streaming: false,
    error: failed ? failureReason(payload, answer ? '' : text) : null,
    stopped: payload.status === 'interrupted'
  }))
  return failed
    ? { ...done, running: false, failed: [...done.failed, failedTurn(done.items)] }
    : { ...done, running: false }
}

// The failed reply is the last item. Before it, past this turn's tool lines and streamed text, is
// the message it answered, unless a delivery or another client started the turn.
function failedTurn(items: ChatItem[]): FailedTurn {
  const reply = items.length - 1
  let start = reply
  while (start > 0 && isTurnWork(items[start - 1])) start -= 1
  const asked = items[start - 1]?.kind === 'user' ? start - 1 : -1
  const first = asked < 0 ? start : asked
  return {
    after: items[first - 1]?.id ?? null,
    items: asked < 0 ? [items[reply]] : [items[asked], items[reply]]
  }
}

// Every finished turn reloads history, so streamed text not yet replaced by a stored row is this
// turn's. A failed reply put back after the reload keeps its live id but ended an earlier turn.
function isTurnWork(item: ChatItem): boolean {
  return (
    item.kind === 'tool' ||
    (item.kind === 'bot' && item.error === null && item.id.startsWith(LIVE_ID))
  )
}

// The engine's account of the failure, else the error it names.
function failureReason(payload: Payload, account: string): string {
  const reason = [account, payload.error, payload.failure_reason].find(
    (value) => typeof value === 'string' && value.trim()
  )
  return typeof reason === 'string' ? reason : ''
}

/**
 * The wait notice with its next attempt counted down: `retry` words the time left, from the
 * seconds the engine named less the time already waited. A notice that names no time is as is.
 */
export function waitLeft(
  wait: string,
  waitedMs: number,
  retry: (seconds: number) => string
): string {
  return wait.replace(RETRY_IN, (_match, seconds: string) =>
    retry(Math.max(0, Number(seconds) - Math.floor(waitedMs / 1000)))
  )
}

// A wait notice shows until the engine clears it with empty text or the turn moves on.
function waitFor(transcript: Transcript, text: string): Transcript {
  if (text.startsWith(WAIT_MARK))
    return { ...transcript, wait: text.slice(WAIT_MARK.length).replace(WAIT_DASH, ', ').trim() }
  return text ? transcript : { ...transcript, wait: null }
}

// A tool line ends the reply segment before it; text after the tool starts a new one.
function endReply(transcript: Transcript): Transcript {
  return lastStreamingReply(transcript) < 0
    ? transcript
    : updateReply(transcript, (reply) => ({ ...reply, streaming: false }))
}

function startTool(transcript: Transcript, payload: Payload): Transcript {
  if (typeof payload.tool_id !== 'string') return transcript
  const args = (payload.args as Payload | null | undefined) ?? {}
  const tool = toolItem(payload.tool_id, String(payload.name ?? 'tool'), args, payload.labels)
  const ended = endReply(transcript)
  return { ...ended, items: [...ended.items, { ...tool, done: false }] }
}

function completeTool(transcript: Transcript, payload: Payload): Transcript {
  const find = (current: Transcript): number =>
    current.items.findIndex((item) => item.kind === 'tool' && item.id === payload.tool_id)
  // A tool that started before this window attached completes without a start frame.
  const started = find(transcript) < 0 ? startTool(transcript, payload) : transcript
  const index = find(started)
  if (index < 0) return started
  const items = [...started.items]
  const tool = items[index] as ToolItem
  items[index] = {
    ...tool,
    label: Array.isArray(payload.labels)
      ? toolItem(tool.id, tool.name, {}, payload.labels).label
      : tool.label,
    seconds: typeof payload.duration_s === 'number' ? payload.duration_s : null,
    done: true
  }
  return { ...started, items }
}
