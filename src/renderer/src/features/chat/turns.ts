import type { ChatItem, MessageItem } from './types'

type ToolItem = Extract<ChatItem, { kind: 'tool' }>

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
    // The chat's own bot at work: its replies and its tool calls. Anything else starts a new turn.
    if (item.kind === 'tool' || (item.kind === 'bot' && item.sender === null)) {
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

function turnResult(work: ChatItem[], running: boolean): MessageItem[] {
  const lastTool = work.map((item) => item.kind).lastIndexOf('tool')
  const lastReply = work.map((item) => item.kind).lastIndexOf('bot')
  // A running turn's reply before its newest tool is text between tools, not the answer yet.
  const answer = running && lastReply < lastTool ? -1 : lastReply
  return work.filter(
    (item, index): item is MessageItem =>
      item.kind === 'bot' && (index === answer || item.error !== null)
  )
}
