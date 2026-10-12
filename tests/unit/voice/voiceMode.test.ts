import { describe, it, expect } from 'vitest'
import { orbStateFor } from '../../../src/renderer/src/features/assistant/orbState'
import { visibleEntries } from '../../../src/renderer/src/features/assistant/transcriptView'
import type { TranscriptEntry } from '../../../src/renderer/src/features/assistant/useAgent'

describe('orbStateFor with speech', () => {
  it('should show the speaking orb over any brain activity', () => {
    expect(orbStateFor({ state: 'thinking', label: '' }, true)).toBe('composing')
    expect(orbStateFor({ state: 'working', label: 'Running x' }, true)).toBe('composing')
    expect(orbStateFor(null, true)).toBe('composing')
  })

  it('should keep the existing states when nothing is being spoken', () => {
    expect(orbStateFor({ state: 'thinking', label: '' }, false)).toBe('solving')
    expect(orbStateFor({ state: 'waiting', label: '' })).toBe('listening')
    expect(orbStateFor(null)).toBe('connecting')
  })
})

describe('visibleEntries', () => {
  const entries: TranscriptEntry[] = [
    { kind: 'user', text: 'how much disk space do I have' },
    { kind: 'assistant', text: 'You have 120 GB free.', interim: false },
    { kind: 'card', card: { kind: 'disk', freeBytes: 1, totalBytes: 2 } },
    { kind: 'action', label: 'Moved 4 files', ok: true, error: null },
    { kind: 'error', key: 'agent_failed', message: 'boom' }
  ]

  it('should hide only the spoken reply in voice mode', () => {
    expect(visibleEntries(entries, true).map((e) => e.kind)).toEqual([
      'user',
      'card',
      'action',
      'error'
    ])
  })

  it('should hide interim narration too', () => {
    const interim: TranscriptEntry[] = [{ kind: 'assistant', text: 'Looking…', interim: true }]
    expect(visibleEntries(interim, true)).toEqual([])
  })

  it('should change nothing when voice mode is off', () => {
    expect(visibleEntries(entries, false)).toEqual(entries)
  })
})
