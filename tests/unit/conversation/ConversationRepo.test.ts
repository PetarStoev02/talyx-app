import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { ConversationRepo } from '../../../src/main/domain/conversation/repository/ConversationRepo'

function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE conversations (
      id         TEXT PRIMARY KEY,
      title      TEXT NOT NULL,
      started_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE conversation_entries (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL,
      kind            TEXT NOT NULL,
      payload         TEXT NOT NULL,
      created_at      INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `)
  return db
}

/** unixepoch() is seconds, so ages are written in seconds too. */
function ageInDays(db: Database.Database, id: string, days: number): void {
  const at = Math.floor(Date.now() / 1000) - days * 86_400
  db.prepare('UPDATE conversations SET started_at = ?, updated_at = ? WHERE id = ?').run(at, at, id)
}

describe('ConversationRepo', () => {
  let db: Database.Database
  let repo: ConversationRepo

  beforeEach(() => {
    db = createTestDb()
    repo = new ConversationRepo(db)
  })

  describe('list', () => {
    it('should return nothing when none were ever started', () => {
      expect(repo.list()).toEqual([])
    })

    it('should return the one conversation that was started', () => {
      repo.start('c1', 'sort my downloads')
      const all = repo.list()
      expect(all).toHaveLength(1)
      expect(all[0]).toMatchObject({ id: 'c1', title: 'sort my downloads' })
      expect(all[0].startedAt).toBeGreaterThan(0)
    })

    it('should return many newest first', () => {
      repo.start('old', 'first')
      repo.start('new', 'second')
      ageInDays(db, 'old', 2)
      expect(repo.list().map((c) => c.id)).toEqual(['new', 'old'])
    })

    it('should stop at the limit it is given', () => {
      repo.start('a', 'a')
      repo.start('b', 'b')
      repo.start('c', 'c')
      expect(repo.list(2)).toHaveLength(2)
    })
  })

  describe('entries', () => {
    it('should return nothing for a conversation that was only started', () => {
      repo.start('c1', 'hello')
      expect(repo.entries('c1')).toEqual([])
    })

    it('should return entries in the order they happened', () => {
      repo.start('c1', 'hello')
      repo.append('c1', { kind: 'user', payload: { text: 'hello' } })
      repo.append('c1', { kind: 'assistant', payload: { text: 'hi', interim: false } })
      expect(repo.entries('c1')).toEqual([
        { kind: 'user', payload: { text: 'hello' } },
        { kind: 'assistant', payload: { text: 'hi', interim: false } }
      ])
    })

    it('should keep each conversation to its own entries', () => {
      repo.start('c1', 'one')
      repo.start('c2', 'two')
      repo.append('c1', { kind: 'user', payload: { text: 'mine' } })
      expect(repo.entries('c2')).toEqual([])
    })

    it('should skip corrupt entry payloads and still return valid ones', () => {
      repo.start('c1', 'hello')
      repo.append('c1', { kind: 'user', payload: { text: 'ok' } })
      db.prepare(
        'INSERT INTO conversation_entries (conversation_id, kind, payload) VALUES (?, ?, ?)'
      ).run('c1', 'assistant', '{not-json')
      expect(repo.entries('c1')).toEqual([{ kind: 'user', payload: { text: 'ok' } }])
    })
  })

  describe('append', () => {
    it('should move the conversation to the top of the list', () => {
      repo.start('old', 'first')
      repo.start('new', 'second')
      ageInDays(db, 'old', 2)
      repo.append('old', { kind: 'user', payload: { text: 'still talking' } })
      expect(repo.list().map((c) => c.id)).toEqual(['old', 'new'])
    })
  })

  describe('remove', () => {
    it('should take the entries with it', () => {
      repo.start('c1', 'hello')
      repo.append('c1', { kind: 'user', payload: { text: 'hello' } })
      repo.remove('c1')
      expect(repo.list()).toEqual([])
      expect(repo.entries('c1')).toEqual([])
    })

    it('should leave the other conversations alone', () => {
      repo.start('c1', 'one')
      repo.start('c2', 'two')
      repo.remove('c1')
      expect(repo.list().map((c) => c.id)).toEqual(['c2'])
    })

    it('should not throw when the conversation is already gone', () => {
      expect(() => repo.remove('never-existed')).not.toThrow()
    })
  })

  describe('removeAll', () => {
    it('should empty both tables', () => {
      repo.start('c1', 'one')
      repo.append('c1', { kind: 'user', payload: { text: 'hello' } })
      repo.start('c2', 'two')
      repo.removeAll()
      expect(repo.list()).toEqual([])
      expect(repo.entries('c1')).toEqual([])
    })
  })

  describe('search', () => {
    it('should return nothing for an empty or whitespace query', () => {
      repo.start('c1', 'sort my downloads')
      expect(repo.search('')).toEqual([])
      expect(repo.search('   ')).toEqual([])
    })

    it('should match a conversation by title', () => {
      repo.start('c1', 'sort my downloads')
      repo.start('c2', 'remind me tomorrow')
      const hits = repo.search('downloads')
      expect(hits).toHaveLength(1)
      expect(hits[0]).toMatchObject({
        id: 'c1',
        title: 'sort my downloads',
        snippet: 'sort my downloads'
      })
      expect(hits[0].rank).toBeGreaterThan(0)
      expect(hits[0].updatedAt).toBeGreaterThan(0)
    })

    it('should match a conversation by entry body text', () => {
      repo.start('c1', 'quick ask')
      repo.append('c1', {
        kind: 'assistant',
        payload: { text: 'Moved the Acme invoice into Documents', interim: false }
      })
      repo.start('c2', 'other')
      const hits = repo.search('Acme invoice')
      expect(hits).toHaveLength(1)
      expect(hits[0].id).toBe('c1')
      expect(hits[0].snippet.toLowerCase()).toContain('acme')
    })

    it('should require every word to match (AND)', () => {
      repo.start('c1', 'sort downloads')
      repo.append('c1', { kind: 'user', payload: { text: 'please organize photos' } })
      expect(repo.search('sort photos')).toHaveLength(1)
      expect(repo.search('sort calendar')).toEqual([])
    })

    it('should score a title hit above a body-only hit', () => {
      repo.start('title-hit', 'Acme contract')
      repo.start('body-hit', 'quick note')
      repo.append('body-hit', { kind: 'user', payload: { text: 'talk about Acme later' } })
      ageInDays(db, 'title-hit', 1)
      const hits = repo.search('Acme')
      expect(hits.map((h) => h.id)).toEqual(['title-hit', 'body-hit'])
      expect(hits[0].rank).toBeGreaterThan(hits[1].rank)
    })

    it('should stop at the limit it is given', () => {
      repo.start('a', 'alpha topic')
      repo.start('b', 'alpha second')
      repo.start('c', 'alpha third')
      expect(repo.search('alpha', 2)).toHaveLength(2)
    })
  })

  describe('removeOlderThan', () => {
    it('should keep a conversation from today', () => {
      repo.start('today', 'fresh')
      expect(repo.removeOlderThan(30)).toBe(0)
      expect(repo.list()).toHaveLength(1)
    })

    it('should keep one that is exactly at the boundary', () => {
      repo.start('boundary', 'edge')
      ageInDays(db, 'boundary', 30)
      repo.removeOlderThan(30)
      expect(repo.list()).toHaveLength(1)
    })

    it('should drop one that is past the boundary, with its entries', () => {
      repo.start('stale', 'old talk')
      repo.append('stale', { kind: 'user', payload: { text: 'hello' } })
      ageInDays(db, 'stale', 31)
      expect(repo.removeOlderThan(30)).toBe(1)
      expect(repo.list()).toEqual([])
      expect(repo.entries('stale')).toEqual([])
    })

    it('should measure age from the last message, not the first', () => {
      repo.start('revived', 'old start')
      ageInDays(db, 'revived', 40)
      repo.append('revived', { kind: 'user', payload: { text: 'back again' } })
      expect(repo.removeOlderThan(30)).toBe(0)
      expect(repo.list()).toHaveLength(1)
    })
  })
})
