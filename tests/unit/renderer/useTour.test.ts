import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSet } = vi.hoisted(() => ({ mockSet: vi.fn(() => Promise.resolve({})) }))
vi.mock('@shared/api/ipc', () => ({ settingsApi: { set: mockSet } }))

import { useTour } from '../../../src/renderer/src/app/providers/useTour'
import { TOUR_STEPS } from '../../../src/renderer/src/widgets/tour/steps'

describe('useTour', () => {
  beforeEach(() => {
    useTour.setState({ stepIndex: null })
    mockSet.mockClear()
  })

  it('should not run until started, then open on the first stop', () => {
    expect(useTour.getState().stepIndex).toBeNull()
    useTour.getState().start()
    expect(useTour.getState().stepIndex).toBe(0)
  })

  it('should walk every stop and finish after the last one', () => {
    useTour.getState().start()
    for (let i = 1; i < TOUR_STEPS.length; i++) {
      useTour.getState().next()
      expect(useTour.getState().stepIndex).toBe(i)
    }
    useTour.getState().next()
    expect(useTour.getState().stepIndex).toBeNull()
    expect(mockSet).toHaveBeenCalledWith({ hasSeenTour: true })
  })

  it('should clamp back at the first stop', () => {
    useTour.getState().start()
    useTour.getState().back()
    expect(useTour.getState().stepIndex).toBe(0)
    useTour.getState().next()
    useTour.getState().back()
    expect(useTour.getState().stepIndex).toBe(0)
  })

  it('should close even when remembering the tour fails', async () => {
    mockSet.mockImplementationOnce(() => Promise.reject(new Error('disk')))
    useTour.getState().start()
    useTour.getState().finish()
    expect(useTour.getState().stepIndex).toBeNull()
    await Promise.resolve()
  })

  it('should ignore next and back while not running', () => {
    useTour.getState().next()
    useTour.getState().back()
    expect(useTour.getState().stepIndex).toBeNull()
    expect(mockSet).not.toHaveBeenCalled()
  })
})
