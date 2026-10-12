import type Database from 'better-sqlite3'
import type { Conversation, ConversationEntry, ConversationEntryKind } from '../model/Conversation'

interface ConversationRow {
  id: string
  title: string
  started_at: number
  updated_at: number
}

interface EntryRow {
  kind: string
  payload: string
}

const DEFAULT_LIMIT = 100
const SECONDS_PER_DAY = 86_400

/** Pure data access for saved conversations. No policy: the recorder owns that. */
export interface ConversationSearchHit {
  id: string
  title: string
  snippet: string
  updatedAt: number
  /** Higher is better. Title matches outrank body-only matches. */
  rank: number
}

const TITLE_HIT_SCORE = 100
const BODY_HIT_SCORE = 10
const SNIPPET_MAX = 120

export class ConversationRepo {
  constructor(private readonly db: Database.Database) {}

  start(id: string, title: string): void {
    this.db.prepare('INSERT OR IGNORE INTO conversations (id, title) VALUES (?, ?)').run(id, title)
  }

  append(conversationId: string, entry: ConversationEntry): void {
    const write = this.db.transaction(() => {
      this.db
        .prepare(
          'INSERT INTO conversation_entries (conversation_id, kind, payload) VALUES (?, ?, ?)'
        )
        .run(conversationId, entry.kind, JSON.stringify(entry.payload))
      // Age is measured from the last message, so an old conversation you come
      // back to does not get swept out from under you.
      this.db
        .prepare('UPDATE conversations SET updated_at = unixepoch() WHERE id = ?')
        .run(conversationId)
    })
    write()
  }

  list(limit: number = DEFAULT_LIMIT): Conversation[] {
    // updated_at has one-second resolution, so a start() immediately followed by an
    // append() elsewhere ties on it. conversations.rowid can't break the tie: it is
    // fixed at insert and never moves on UPDATE. conversation_entries.id does grow on
    // every append, so it is the tiebreak that actually reflects last-touched order
    // (NULL for a conversation with no entries sorts last). started_at DESC, id DESC
    // make the ordering total: two conversations started the same second that were
    // never appended to would otherwise tie on both updated_at and the MAX(id)
    // subquery (NULL = NULL), leaving their order implementation-defined and able
    // to flip between calls.
    const rows = this.db
      .prepare(
        `SELECT * FROM conversations
         ORDER BY updated_at DESC,
           (SELECT MAX(id) FROM conversation_entries WHERE conversation_id = conversations.id) DESC,
           started_at DESC,
           id DESC
         LIMIT ?`
      )
      .all(limit) as ConversationRow[]
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      startedAt: row.started_at,
      updatedAt: row.updated_at
    }))
  }

  entries(conversationId: string): ConversationEntry[] {
    const rows = this.db
      .prepare(
        'SELECT kind, payload FROM conversation_entries WHERE conversation_id = ? ORDER BY id'
      )
      .all(conversationId) as EntryRow[]
    const out: ConversationEntry[] = []
    for (const row of rows) {
      try {
        out.push({
          kind: row.kind as ConversationEntryKind,
          payload: JSON.parse(row.payload) as unknown
        })
      } catch {
        // Skip corrupt payloads so search/open keep working.
      }
    }
    return out
  }

  /**
   * Keyword search over titles and entry payloads. Every word must match
   * somewhere in the conversation (title or body). Empty query → [].
   */
  search(query: string, limit: number = DEFAULT_LIMIT): ConversationSearchHit[] {
    const words = query
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 0)
    if (words.length === 0 || limit <= 0) return []

    const rows = this.db
      .prepare('SELECT id, title, updated_at AS updatedAt FROM conversations')
      .all() as { id: string; title: string; updatedAt: number }[]

    const hits: ConversationSearchHit[] = []
    for (const row of rows) {
      const bodyTexts = entryTexts(this.entries(row.id))
      const titleLower = row.title.toLowerCase()
      const bodyLower = bodyTexts.join('\n').toLowerCase()
      const haystack = `${titleLower}\n${bodyLower}`
      if (!words.every((w) => haystack.includes(w))) continue

      const titleHit = scoreTitle(words, titleLower)
      const bodyHit = words.some((w) => bodyLower.includes(w)) ? BODY_HIT_SCORE : 0
      const rank = titleHit + bodyHit

      hits.push({
        id: row.id,
        title: row.title,
        snippet: titleHit > 0 ? row.title : snippetFromTexts(bodyTexts, words),
        updatedAt: row.updatedAt,
        rank
      })
    }

    hits.sort((a, b) => b.rank - a.rank || b.updatedAt - a.updatedAt)
    return hits.slice(0, limit)
  }

  remove(id: string): void {
    const drop = this.db.transaction(() => {
      this.db.prepare('DELETE FROM conversation_entries WHERE conversation_id = ?').run(id)
      this.db.prepare('DELETE FROM conversations WHERE id = ?').run(id)
    })
    drop()
  }

  removeAll(): void {
    const drop = this.db.transaction(() => {
      this.db.prepare('DELETE FROM conversation_entries').run()
      this.db.prepare('DELETE FROM conversations').run()
    })
    drop()
  }

  /** Returns how many conversations were swept. */
  removeOlderThan(days: number, now: number = Date.now()): number {
    const cutoff = Math.floor(now / 1000) - days * SECONDS_PER_DAY
    const stale = this.db
      .prepare('SELECT id FROM conversations WHERE updated_at < ?')
      .all(cutoff) as { id: string }[]
    for (const row of stale) this.remove(row.id)
    return stale.length
  }
}

function entryTexts(entries: ConversationEntry[]): string[] {
  const texts: string[] = []
  for (const entry of entries) {
    if (entry.kind !== 'user' && entry.kind !== 'assistant') continue
    const text = textFromPayload(entry.payload)
    if (text) texts.push(text)
  }
  return texts
}

/** Full title match outranks body; partial title match still beats body-only. */
function scoreTitle(words: string[], titleLower: string): number {
  if (words.every((w) => titleLower.includes(w))) return TITLE_HIT_SCORE
  if (words.some((w) => titleLower.includes(w))) return TITLE_HIT_SCORE / 2
  return 0
}

function textFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const text = (payload as { text?: unknown }).text
  return typeof text === 'string' && text.trim().length > 0 ? text : null
}

function snippetFromTexts(texts: string[], words: string[]): string {
  const needle = words[0] ?? ''
  for (const text of texts) {
    const lower = text.toLowerCase()
    const at = needle ? lower.indexOf(needle) : 0
    if (at < 0) continue
    const start = Math.max(0, at - 40)
    const slice = text.slice(start, start + SNIPPET_MAX).trim()
    return start > 0 ? `…${slice}` : slice
  }
  return texts[0]?.slice(0, SNIPPET_MAX) ?? ''
}
