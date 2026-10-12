import { describe, it, expect } from 'vitest'
import {
  decisionForKey,
  KEY_GUARD_MS,
  type CardKey
} from '../../../src/renderer/src/features/assistant/approvalKeys'

function key(partial: Partial<CardKey>): CardKey {
  return {
    key: '',
    code: '',
    repeat: false,
    altKey: false,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    ...partial
  }
}

const SETTLED = KEY_GUARD_MS + 1

describe('decisionForKey', () => {
  it('should approve on Enter once the card has settled', () => {
    expect(decisionForKey(key({ key: 'Enter', code: 'Enter' }), SETTLED)).toBe('approve')
  })

  it('should ignore Enter typed just before the card appeared', () => {
    expect(decisionForKey(key({ key: 'Enter', code: 'Enter' }), KEY_GUARD_MS - 1)).toBeNull()
  })

  it('should ignore a held-down key', () => {
    expect(decisionForKey(key({ key: 'Enter', code: 'Enter', repeat: true }), SETTLED)).toBeNull()
  })

  it('should not treat a bare "a" as approve-the-rest', () => {
    expect(decisionForKey(key({ key: 'a', code: 'KeyA' }), SETTLED)).toBeNull()
  })

  it('should approve the rest on Option+A', () => {
    expect(decisionForKey(key({ key: 'å', code: 'KeyA', altKey: true }), SETTLED)).toBe('rest')
  })

  it('should deny on Escape at once, since denying is always safe', () => {
    expect(decisionForKey(key({ key: 'Escape', code: 'Escape' }), 0)).toBe('deny')
  })

  it.each(['b', 'Tab', ' '])('should ignore "%s"', (k) => {
    expect(decisionForKey(key({ key: k }), SETTLED)).toBeNull()
  })
})
