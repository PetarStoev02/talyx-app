import { describe, expect, it } from 'vitest'
import {
  EXPECTED_ENGINE_VERSION,
  engineVersionFit,
  type EngineVersionFit
} from '../../../src/shared/engine'

describe('engineVersionFit', () => {
  it.each([
    ['0.21.0', 'older'],
    ['0.22.4', 'older'],
    ['0.22.5', 'same'],
    ['0.22.10', 'newer'],
    ['1.0.0', 'newer'],
    ['garbage', 'unknown'],
    ['0.22', 'unknown'],
    [null, 'unknown']
  ] as [string | null, EngineVersionFit][])(
    'should fit %s as %s against the expected engine',
    (found, fit) => {
      expect(engineVersionFit(found)).toBe(fit)
    }
  )

  it('should compare with the given version instead of the built-in one', () => {
    expect(engineVersionFit('1.2.3', '1.2.3')).toBe('same')
    expect(EXPECTED_ENGINE_VERSION).toBe('0.22.5')
  })
})
