import type Database from 'better-sqlite3'
import type { ActionLog, ActionLogEntry } from '../../domain/agent/AgentSession'

const SECONDS_PER_DAY = 86_400

interface Row {
  proposal_id: string
  tool: string
  label: string
  payload: string
  inverse: string | null
  ok: number
}

export class ActionLogRepo implements ActionLog {
  constructor(private readonly db: Database.Database) {}

  append(entry: ActionLogEntry): void {
    this.db
      .prepare(
        `INSERT INTO agent_actions (session_id, proposal_id, tool, label, payload, inverse, ok, error)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        entry.sessionId,
        entry.proposalId,
        entry.tool,
        entry.label,
        JSON.stringify(entry.payload),
        entry.inverse === null ? null : JSON.stringify(entry.inverse),
        entry.ok ? 1 : 0,
        entry.error
      )
  }

  /** Operations of the newest proposal whose every operation succeeded and has an inverse; null if none. */
  latestUndoable(): { tool: string; label: string; payload: unknown; inverse: unknown }[] | null {
    const proposals = this.db
      .prepare(`SELECT proposal_id FROM agent_actions GROUP BY proposal_id ORDER BY MAX(id) DESC`)
      .all() as { proposal_id: string }[]
    for (const { proposal_id } of proposals) {
      const rows = this.db
        .prepare(
          `SELECT proposal_id, tool, label, payload, inverse, ok FROM agent_actions
           WHERE proposal_id = ? ORDER BY id`
        )
        .all(proposal_id) as Row[]
      if (rows.every((r) => r.ok === 1 && r.inverse !== null)) {
        return rows.map((r) => ({
          tool: r.tool,
          label: r.label,
          payload: JSON.parse(r.payload),
          inverse: JSON.parse(r.inverse!)
        }))
      }
    }
    return null
  }

  /** Payloads hold message recipients and bodies; they follow the conversations' retention. */
  removeOlderThan(days: number, now: number = Date.now()): number {
    const cutoff = Math.floor(now / 1000) - days * SECONDS_PER_DAY
    return this.db.prepare('DELETE FROM agent_actions WHERE created_at < ?').run(cutoff).changes
  }

  removeAll(): void {
    this.db.prepare('DELETE FROM agent_actions').run()
  }
}
