import type { ChatItem, MessageItem } from './types'

type ToolItem = Extract<ChatItem, { kind: 'tool' }>
type UserItem = Extract<ChatItem, { kind: 'user' }>
type BotItem = Extract<ChatItem, { kind: 'bot' }>

/** The id prefix of your message from its send until the reload after its turn stores it. */
export const SENDING_ID = 'local-'

/**
 * How your last message's turn ended when it gave no answer: it failed, you stopped it before
 * any text, or it ended without a reply (an empty answer, a lost turn). The asked message is
 * what a retry sends again.
 */
export interface TurnOutcome {
  kind: 'failed' | 'stopped' | 'noReply'
  asked: UserItem
}

/** What the running turn is doing: its newest tool (null before the first) and how many it ran. */
export interface TurnActivity {
  tool: ToolItem | null
  tools: number
}

/**
 * The chat as shown: each turn keeps what came in (your message, a delivery, a notice), its errors
 * and its final reply. Tool lines and the text a bot wrote between tools are dropped; while the
 * bot works, the activity stands in for them and only the reply streaming after the last tool shows.
 */
export function turnView(
  items: ChatItem[],
  running: boolean
): { items: MessageItem[]; activity: TurnActivity | null } {
  const shown: MessageItem[] = []
  let work: ChatItem[] = []
  for (const item of items) {
    // Anything but the chat's own bot at work starts a new turn.
    if (isOwnWork(item)) {
      work.push(item)
      continue
    }
    shown.push(...turnResult(work, false), item)
    work = []
  }
  shown.push(...turnResult(work, running))
  if (!running) return { items: shown, activity: null }
  const tools = work.filter((item): item is ToolItem => item.kind === 'tool')
  return { items: shown, activity: { tool: tools.at(-1) ?? null, tools: tools.length } }
}

/** The outcome of your last message's turn, once it ended without an answer; null otherwise. */
export function turnOutcome(items: ChatItem[], running: boolean): TurnOutcome | null {
  if (running) return null
  const at = items.map((item) => item.kind).lastIndexOf('user')
  const asked = items[at] as UserItem | undefined
  const work = items.slice(at + 1)
  // Something else came in after it (a delivery, a notice): the chat moved on.
  if (!asked || !work.every(isOwnWork)) return null
  const replies = work.filter((item) => item.kind === 'bot')
  if (replies.some((reply) => reply.error !== null)) return { kind: 'failed', asked }
  if (replies.some((reply) => reply.text)) return null
  if (replies.some((reply) => reply.stopped)) return { kind: 'stopped', asked }
  // Still on its way: the engine has not started its turn yet.
  if (!replies.length && asked.id.startsWith(SENDING_ID)) return null
  return { kind: 'noReply', asked }
}

// The chat's own bot at work: its replies and its tool calls.
function isOwnWork(item: ChatItem): item is ToolItem | (BotItem & { sender: null }) {
  return item.kind === 'tool' || (item.kind === 'bot' && item.sender === null)
}

function turnResult(work: ChatItem[], running: boolean): MessageItem[] {
  const lastTool = work.map((item) => item.kind).lastIndexOf('tool')
  const lastReply = work.map((item) => item.kind).lastIndexOf('bot')
  // A running turn's reply before its newest tool is text between tools, not the answer yet.
  const answer = running && lastReply < lastTool ? -1 : lastReply
  // A reply with no text is no bubble: while it runs the activity line stands for it, and once it
  // ends (a stop before any text, an empty answer) the turn's outcome says what happened.
  return work.filter(
    (item, index): item is MessageItem =>
      item.kind === 'bot' && (item.error !== null || (index === answer && item.text !== ''))
  )
}
