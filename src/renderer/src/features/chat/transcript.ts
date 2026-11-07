import type { GatewayEvent } from '@shared/engine/shared'
import type { SessionMessage } from '@shared/engine/types'
import type { ChatItem, ChatPrompt, StreamCursor, Transcript } from './types'

// A message another bot delivered: `Message from 🤖 <name> (@<handle>): <text>`.
const DELIVERY = /^Message from 🤖 (.+?) \(@([^\s)]+)\):\s*([\s\S]*)$/
// Rows the engine writes into the chat itself (a delivery, a finished job, a model switch): no
// one typed them, so they show as one quiet line.
const NOTICE_KINDS = new Set([
  'internal_notification',
  'model_switch',
  'async_delegation_complete',
  'process_complete',
  'auto_continue',
  'personality_switch',
  'failed_turn'
])
const MESSAGE_AGENT = 'message_agent'
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
  return { sessionId, items, prompts: [], running, lastSeq: 0, epoch: null, stream: null }
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
  switch (event.type) {
    case 'message.start':
      return startReply(transcript, payload, String(event.seq ?? ''))
    case 'message.delta':
      return typeof payload.text === 'string' && payload.text
        ? streamText(transcript, payload, payload.text, String(event.seq ?? ''))
        : transcript
    case 'message.complete':
      return completeReply(transcript, payload, String(event.seq ?? ''))
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
  if (message.display_kind === 'hidden') return []
  const id = String(message.row_id ?? message.id ?? '')
  const text = messageText(message.display_content ?? message.content)
  if (message.role === 'user') {
    const delivery = DELIVERY.exec(text)
    if (delivery) {
      const [, name, profile, body] = delivery
      return [
        { kind: 'bot', id, text: body, streaming: false, error: null, sender: { name, profile } }
      ]
    }
    if (message.display_kind && NOTICE_KINDS.has(message.display_kind))
      return [{ kind: 'notice', id, text: noticeText(message, text) }]
    return [userItem(id, text)]
  }
  if (message.role === 'assistant')
    return text.trim()
      ? [{ kind: 'bot', id, text, streaming: false, error: null, sender: null }]
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

function withStreamingReply(transcript: Transcript, id: string): Transcript {
  if (lastStreamingReply(transcript) >= 0) return transcript
  const reply: BotItem = {
    kind: 'bot',
    id: `live-${id}`,
    text: '',
    streaming: true,
    error: null,
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
  // The final text covers the whole turn; it fills the reply only when nothing streamed into it.
  const text = typeof payload.text === 'string' ? payload.text : ''
  if (lastStreamingReply(transcript) < 0 && !text && !failed)
    return { ...transcript, running: false }
  const done = updateReply(withStreamingReply(transcript, id), (reply) => ({
    ...reply,
    text: reply.text || text,
    streaming: false,
    error: failed ? String(payload.error ?? payload.failure_reason ?? '') || null : null
  }))
  return { ...done, running: false }
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
