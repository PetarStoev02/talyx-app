import { describe, it, expect, beforeEach } from 'vitest'
import { ConversationRecorder } from '../../../src/main/domain/conversation/services/ConversationRecorder'
import type { ConversationEntry } from '../../../src/main/domain/conversation/model/Conversation'

/** Stands in for ConversationRepo; only what the recorder actually calls. */
class FakeRepo {
  started: { id: string; title: string }[] = []
  appended: { id: string; entry: ConversationEntry }[] = []

  start(id: string, title: string): void {
    this.started.push({ id, title })
  }

  append(id: string, entry: ConversationEntry): void {
    this.appended.push({ id, entry })
  }
}

describe('ConversationRecorder', () => {
  let repo: FakeRepo
  let recorder: ConversationRecorder
  let ids: string[]

  beforeEach(() => {
    repo = new FakeRepo()
    ids = ['id-1', 'id-2', 'id-3']
    recorder = new ConversationRecorder(repo, () => ids.shift() ?? 'exhausted')
  })

  describe('starting', () => {
    it('should open a conversation named after the first instruction', () => {
      recorder.startedBy('sort my downloads')
      expect(repo.started).toEqual([{ id: 'id-1', title: 'sort my downloads' }])
      expect(repo.appended).toEqual([
        { id: 'id-1', entry: { kind: 'user', payload: { text: 'sort my downloads' } } }
      ])
    })

    it('should keep the second instruction in the same conversation', () => {
      recorder.startedBy('first')
      recorder.startedBy('second')
      expect(repo.started).toHaveLength(1)
      expect(repo.appended.map((a) => a.id)).toEqual(['id-1', 'id-1'])
    })

    it('should open a new conversation after it is closed', () => {
      recorder.startedBy('first')
      recorder.close()
      recorder.startedBy('second')
      expect(repo.started.map((s) => s.id)).toEqual(['id-1', 'id-2'])
    })

    it('should report which conversation is open', () => {
      expect(recorder.openId()).toBeNull()
      recorder.startedBy('hello')
      expect(recorder.openId()).toBe('id-1')
      recorder.close()
      expect(recorder.openId()).toBeNull()
    })
  })

  describe('recording what the transcript shows', () => {
    beforeEach(() => {
      recorder.startedBy('hello')
      repo.appended = []
    })

    it('should record the answer', () => {
      recorder.observe({ type: 'text', text: 'here you go', interim: false })
      expect(repo.appended[0].entry).toEqual({
        kind: 'assistant',
        payload: { text: 'here you go', interim: false }
      })
    })

    it('should record narration the same way the transcript shows it', () => {
      recorder.observe({ type: 'text', text: 'looking…', interim: true })
      expect(repo.appended[0].entry).toEqual({
        kind: 'assistant',
        payload: { text: 'looking…', interim: true }
      })
    })

    it('should record a result card', () => {
      const card = { kind: 'disk', freeBytes: 1, totalBytes: 2 } as never
      recorder.observe({ type: 'card', card })
      expect(repo.appended[0].entry).toEqual({ kind: 'card', payload: { card } })
    })

    it('should record an action with its outcome', () => {
      recorder.observe({ type: 'action', label: 'Move 3 files', ok: true, error: null })
      expect(repo.appended[0].entry).toEqual({
        kind: 'action',
        payload: { label: 'Move 3 files', ok: true, error: null }
      })
    })

    it('should record an error', () => {
      recorder.observe({ type: 'error', key: 'agent_failed', message: 'went wrong' })
      expect(repo.appended[0].entry).toEqual({
        kind: 'error',
        payload: { key: 'agent_failed', message: 'went wrong' }
      })
    })
  })

  describe('ignoring what the transcript does not show', () => {
    beforeEach(() => {
      recorder.startedBy('hello')
      repo.appended = []
    })

    it.each([
      ['a status tick', { type: 'status', state: 'thinking', label: '' }],
      ['the end of a turn', { type: 'done' }],
      ['an approval request', { type: 'approval', request: { text: '', proposals: [] } }]
    ])('should store nothing for %s', (_name, event) => {
      recorder.observe(event as never)
      expect(repo.appended).toEqual([])
    })

    it('should store nothing when no conversation is open', () => {
      recorder.close()
      recorder.observe({ type: 'text', text: 'orphan', interim: false })
      expect(repo.appended).toEqual([])
    })
  })

  describe('reopening', () => {
    it('should append the next instruction to the reopened conversation', () => {
      recorder.reopen('from-yesterday')
      recorder.startedBy('carry on')
      expect(repo.started).toEqual([])
      expect(repo.appended).toEqual([
        { id: 'from-yesterday', entry: { kind: 'user', payload: { text: 'carry on' } } }
      ])
    })
  })
})
