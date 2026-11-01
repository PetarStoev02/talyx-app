import type Database from 'better-sqlite3'
import type { BotSignal, T3Status } from '../model'

const placeholders = (n: number): string => Array(n).fill('?').join(',')
// Chat rows stored before owner messages existed carry no author or message id.
const readSignal = (json: string): BotSignal => {
  const s = JSON.parse(json) as BotSignal
  return s.kind === 'chat' ? { ...s, author: s.author ?? 'bot', messageId: s.messageId ?? null } : s
}
const parse = (rows: { payload_json: string }[]): BotSignal[] =>
  rows.map((r) => readSignal(r.payload_json))

export class SignalRepo {
  constructor(private readonly db: Database.Database) {}

  append(s: BotSignal): void {
    this.db
      .prepare('INSERT INTO signals (bot_id, kind, payload_json, at) VALUES (?, ?, ?, ?)')
      .run(s.botId, s.kind, JSON.stringify(s), s.at)
  }

  recent(botIds: string[], since: string): BotSignal[] {
    if (botIds.length === 0) return []
    return parse(
      this.db
        .prepare(
          `SELECT payload_json FROM signals
           WHERE bot_id IN (${placeholders(botIds.length)}) AND at >= ? ORDER BY at, id`
        )
        .all(...botIds, since) as { payload_json: string }[]
    )
  }

  latestFeed(projectBotIds: string[], limit: number): BotSignal[] {
    if (projectBotIds.length === 0) return []
    return parse(
      this.db
        .prepare(
          `SELECT payload_json FROM signals
           WHERE bot_id IN (${placeholders(projectBotIds.length)}) ORDER BY at DESC, id DESC LIMIT ?`
        )
        .all(...projectBotIds, limit) as { payload_json: string }[]
    )
  }

  /** Latest `limit` chat messages of a group, oldest first. */
  groupChat(groupId: string, limit: number): BotSignal[] {
    return parse(
      this.db
        .prepare(
          `SELECT payload_json FROM (
             SELECT payload_json, at, id FROM signals
             WHERE kind = 'chat' AND json_extract(payload_json, '$.groupId') = ?
             ORDER BY at DESC, id DESC LIMIT ?
           ) ORDER BY at, id`
        )
        .all(groupId, limit) as { payload_json: string }[]
    )
  }

  /** Latest `limit` signals of a bot with one of `kinds`, oldest first. */
  botTimeline(botId: string, kinds: BotSignal['kind'][], limit: number): BotSignal[] {
    if (kinds.length === 0) return []
    return parse(
      this.db
        .prepare(
          `SELECT payload_json FROM (
             SELECT payload_json, at, id FROM signals
             WHERE bot_id = ? AND kind IN (${placeholders(kinds.length)})
             ORDER BY at DESC, id DESC LIMIT ?
           ) ORDER BY at, id`
        )
        .all(botId, ...kinds, limit) as { payload_json: string }[]
    )
  }

  hasMessageId(messageId: string): boolean {
    return (
      this.db
        .prepare(
          `SELECT 1 FROM signals
           WHERE kind IN ('chat', 'dm') AND json_extract(payload_json, '$.messageId') = ? LIMIT 1`
        )
        .get(messageId) !== undefined
    )
  }

  hasOwnerMessageId(messageId: string): boolean {
    return (
      this.db
        .prepare(
          `SELECT 1 FROM signals
           WHERE kind IN ('chat', 'dm') AND json_extract(payload_json, '$.author') = 'owner'
           AND json_extract(payload_json, '$.messageId') = ? LIMIT 1`
        )
        .get(messageId) !== undefined
    )
  }

  failedRunIds(runIds: string[]): Set<string> {
    if (runIds.length === 0) return new Set()
    return new Set(
      this.db
        .prepare(
          `SELECT DISTINCT json_extract(payload_json, '$.runId') FROM signals
           WHERE kind = 'task-failed'
           AND json_extract(payload_json, '$.runId') IN (${placeholders(runIds.length)})`
        )
        .pluck()
        .all(...runIds) as string[]
    )
  }

  deleteForBot(botId: string): void {
    this.db.prepare('DELETE FROM signals WHERE bot_id = ?').run(botId)
  }

  threadOwner(threadId: string): string | null {
    const find = (kind: string): string | undefined =>
      this.db
        .prepare(
          `SELECT bot_id FROM signals
           WHERE kind = ? AND json_extract(payload_json, '$.t3ThreadId') = ?
           ORDER BY at DESC, id DESC LIMIT 1`
        )
        .pluck()
        .get(kind, threadId) as string | undefined
    return find('task') ?? find('t3') ?? null
  }

  latestT3Statuses(): Map<string, T3Status> {
    const rows = this.db
      .prepare(
        `SELECT json_extract(payload_json, '$.t3ThreadId') AS id,
                json_extract(payload_json, '$.status') AS status
         FROM signals WHERE kind = 't3' ORDER BY at, id`
      )
      .all() as { id: string; status: T3Status }[]
    return new Map(rows.map((r) => [r.id, r.status]))
  }

  /** Threads reported by bots (task) or watched (t3) that have not been recorded as done. */
  ownedThreadIds(): string[] {
    const done = new Set(
      [...this.latestT3Statuses()].filter(([, s]) => s === 'done').map(([id]) => id)
    )
    const ids = this.db
      .prepare(
        `SELECT DISTINCT json_extract(payload_json, '$.t3ThreadId') FROM signals
         WHERE kind IN ('task', 't3') AND json_extract(payload_json, '$.t3ThreadId') IS NOT NULL`
      )
      .pluck()
      .all() as string[]
    return ids.filter((id) => !done.has(id))
  }
}
