import { describe, it, expect } from 'vitest'
import { TOUR_STEPS } from '../../../src/renderer/src/widgets/tour/steps'
import { t } from '../../../src/renderer/src/shared/lib/i18n'

describe('TOUR_STEPS', () => {
  it('should have five unique stops in the spec order', () => {
    expect(TOUR_STEPS.map((s) => s.id)).toEqual([
      'ask-input',
      'ask-chips',
      'approval',
      'files-group',
      'feedback'
    ])
  })

  it('should translate every title and body in both languages', () => {
    for (const step of TOUR_STEPS) {
      for (const lang of ['en', 'bg']) {
        expect(t(step.titleKey, lang)).not.toBe(step.titleKey)
        expect(t(step.bodyKey, lang)).not.toBe(step.bodyKey)
      }
    }
  })

  it('should center only the approval stop', () => {
    expect(TOUR_STEPS.filter((s) => s.target === null).map((s) => s.id)).toEqual(['approval'])
  })
})
