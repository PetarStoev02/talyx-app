import type Database from 'better-sqlite3'
import type { BotSignal } from '../model'

const placeholders = (n: number): string => Array(n).fill('?').join(',')
const parse = (rows: { payload_json: string }[]): BotSignal[] =>
  rows.map((r) => JSON.parse(r.payload_json) as BotSignal)

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
}
