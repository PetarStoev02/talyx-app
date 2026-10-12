import { describe, it, expect } from 'vitest'
import { overallSortProgress } from '../../../src/renderer/src/shared/lib/sortProgress'

describe('overallSortProgress', () => {
  it('should map each phase into its own slice of the bar', () => {
    expect(overallSortProgress('extracting', 0, 100)).toBe(5)
    expect(overallSortProgress('extracting', 100, 100)).toBe(40)
    expect(overallSortProgress('classifying-ai', 0, 200)).toBe(40)
    expect(overallSortProgress('classifying-ai', 200, 200)).toBe(100)
  })

  it('should never go backwards across sequential phases', () => {
    const endExtract = overallSortProgress('extracting', 284, 284)
    const startAi = overallSortProgress('classifying-ai', 0, 100)
    expect(startAi).toBe(endExtract)
  })

  it('should return 100 for done', () => {
    expect(overallSortProgress('done', 0, 0)).toBe(100)
  })

  it('should return 0 for unknown phases', () => {
    expect(overallSortProgress(undefined, 5, 10)).toBe(0)
    expect(overallSortProgress('mystery', 5, 10)).toBe(0)
  })

  it('should clamp overshooting counts', () => {
    expect(overallSortProgress('extracting', 500, 100)).toBe(40)
    expect(overallSortProgress('extracting', -5, 100)).toBe(5)
  })

  it('should not divide by zero', () => {
    expect(overallSortProgress('classifying-ai', 0, 0)).toBe(40)
  })
})
