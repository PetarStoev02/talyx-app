import { describe, it, expect } from 'vitest'
import { replayText } from '../../../src/main/domain/conversation/services/replay'
import type { ConversationEntry } from '../../../src/main/domain/conversation/model/Conversation'

const user = (text: string): ConversationEntry => ({ kind: 'user', payload: { text } })
const assistant = (text: string, interim = false): ConversationEntry => ({
  kind: 'assistant',
  payload: { text, interim }
})

describe('replayText', () => {
  it('should be empty when there is nothing to replay', () => {
    expect(replayText([])).toBe('')
  })

  it('should put the earlier turns in order, labelled', () => {
    const text = replayText([user('sort my downloads'), assistant('Done, 12 files moved.')])
    expect(text).toContain('You: sort my downloads')
    expect(text).toContain('Talyx: Done, 12 files moved.')
    expect(text.indexOf('You:')).toBeLessThan(text.indexOf('Talyx:'))
  })

  it('should mark the block as an earlier conversation, not a new instruction', () => {
    expect(replayText([user('hello')])).toMatch(/^Earlier in this conversation:/)
  })

  it('should leave out narration the model wrote before calling a tool', () => {
    expect(replayText([assistant('looking…', true), assistant('Found it.')])).not.toContain(
      'looking…'
    )
  })

  it('should summarise what was done as one line each', () => {
    const entries: ConversationEntry[] = [
      { kind: 'action', payload: { label: 'Move 3 files', ok: true, error: null } }
    ]
    expect(replayText(entries)).toContain('Talyx did: Move 3 files')
  })

  it('should say when something failed so it is not retried blindly', () => {
    const entries: ConversationEntry[] = [
      { kind: 'action', payload: { label: 'Open Mail', ok: false, error: 'not running' } }
    ]
    const text = replayText(entries)
    expect(text).toContain('Open Mail')
    expect(text).toContain('failed')
  })

  it('should leave out cards and errors, which are for the screen', () => {
    const entries: ConversationEntry[] = [
      { kind: 'card', payload: { card: { kind: 'disk' } } },
      { kind: 'error', payload: { key: 'agent_failed', message: 'boom' } }
    ]
    expect(replayText(entries)).toBe('')
  })

  it('should survive a payload that is not the shape it expects', () => {
    const entries: ConversationEntry[] = [{ kind: 'user', payload: null }]
    expect(() => replayText(entries)).not.toThrow()
    expect(replayText(entries)).toBe('')
  })
})
