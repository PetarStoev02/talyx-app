import { describe, it, expect } from 'vitest'
import { orbStateFor, statusLabelKey } from '../../../src/renderer/src/features/assistant/orbState'

describe('orbStateFor', () => {
  it.each([
    [null, 'connecting'],
    [{ state: 'thinking', label: '' }, 'solving'],
    [{ state: 'searching', label: 'Reading x' }, 'searching'],
    [{ state: 'working', label: 'Running x' }, 'working'],
    [{ state: 'waiting', label: '' }, 'listening']
  ] as const)('should map %j to %s', (status, orb) => {
    expect(orbStateFor(status)).toBe(orb)
  })
})

describe('statusLabelKey', () => {
  it('should translate the fixed states and pass tool labels through', () => {
    expect(statusLabelKey({ state: 'thinking', label: '' })).toBe('assistant.status.thinking')
    expect(statusLabelKey({ state: 'waiting', label: '' })).toBe('assistant.status.waiting')
    expect(statusLabelKey({ state: 'working', label: 'Running npm test' })).toBeNull()
  })
})
