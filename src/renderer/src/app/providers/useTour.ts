import { create } from 'zustand'
import { settingsApi } from '@shared/api/ipc'
import { TOUR_STEPS } from '@widgets/tour/steps'

interface TourState {
  /** Index into TOUR_STEPS while running, null otherwise. */
  stepIndex: number | null
  start: () => void
  next: () => void
  back: () => void
  finish: () => void
}

export const useTour = create<TourState>((set, get) => ({
  stepIndex: null,
  start: () => set({ stepIndex: 0 }),
  next: () => {
    const { stepIndex, finish } = get()
    if (stepIndex === null) return
    if (stepIndex >= TOUR_STEPS.length - 1) finish()
    else set({ stepIndex: stepIndex + 1 })
  },
  back: () => {
    const { stepIndex } = get()
    if (stepIndex === null) return
    set({ stepIndex: Math.max(0, stepIndex - 1) })
  },
  finish: () => {
    if (get().stepIndex === null) return
    set({ stepIndex: null })
    // A failed write only means the tour shows once more next launch.
    void settingsApi.set({ hasSeenTour: true }).catch(() => undefined)
  }
}))
