import type { ChatMessage, ConversationTarget } from '../../../../shared/office'
import type { BotSignal } from '../model'
import type { RosterRepo } from '../repository/RosterRepo'
import type { SignalRepo } from '../repository/SignalRepo'
import { describeSignal } from '../describeSignal'

const MAX_MESSAGES = 200
const NO_REPLY_MS = 10 * 60_000
const BOT_TIMELINE_KINDS: BotSignal['kind'][] = ['dm', 'task', 'result', 'task-failed', 't3']

export interface GetConversationDeps {
  roster: Pick<RosterRepo, 'allBots'>
  signals: Pick<SignalRepo, 'groupChat' | 'botTimeline' | 'failedRunIds'>
  now: () => Date
}

export class GetConversation {
  constructor(private readonly deps: GetConversationDeps) {}

  execute(target: ConversationTarget): ChatMessage[] {
    const { signals } = this.deps
    const found =
      target.kind === 'group'
        ? signals.groupChat(target.groupId, MAX_MESSAGES)
        : signals.botTimeline(target.botId, BOT_TIMELINE_KINDS, MAX_MESSAGES)
    const ownerIds = found.flatMap((s) =>
      (s.kind === 'chat' || s.kind === 'dm') && s.author === 'owner' && s.messageId
        ? [s.messageId]
        : []
    )
    const failed = signals.failedRunIds(ownerIds)
    const ownerIdSet = new Set(ownerIds)
    const names = new Map(this.deps.roster.allBots().map((b) => [b.id, b.name]))
    const nameOf = (id: string): string => names.get(id) ?? id

    const messages: ChatMessage[] = []
    for (const s of found) {
      if (s.kind === 'task-failed' && s.runId && ownerIdSet.has(s.runId)) continue
      const message = this.toMessage(s, nameOf, failed, messages.length)
      if (message) messages.push(message)
    }
    return this.withReplyStatus(messages)
  }

  private toMessage(
    s: BotSignal,
    nameOf: (id: string) => string,
    failed: Set<string>,
    index: number
  ): ChatMessage | null {
    if (s.kind === 'chat' || s.kind === 'dm') {
      if (s.text === null) return null
      const owner = s.author === 'owner'
      return {
        key: s.messageId ?? `${s.at}:${index}`,
        author: owner ? 'owner' : s.botId,
        kind: 'text',
        text: s.text,
        at: s.at,
        status: owner ? (s.messageId && failed.has(s.messageId) ? 'failed' : 'sent') : null
      }
    }
    const text = describeSignal(s, nameOf)
    if (text === null) return null
    return {
      key: `${s.at}:${index}`,
      author: s.botId,
      kind:
        s.kind === 'task-failed'
          ? 'failed'
          : s.kind === 't3'
            ? 't3'
            : s.kind === 'task'
              ? 'task'
              : 'result',
      text,
      at: s.at,
      status: null
    }
  }

  private withReplyStatus(messages: ChatMessage[]): ChatMessage[] {
    const now = this.deps.now().getTime()
    return messages.map((m, i) => {
      if (m.status !== 'sent') return m
      const overdue = now - Date.parse(m.at) > NO_REPLY_MS
      const replied = messages.slice(i + 1).some((n) => n.author !== 'owner' && n.kind === 'text')
      return overdue && !replied ? { ...m, status: 'no-reply' } : m
    })
  }
}
