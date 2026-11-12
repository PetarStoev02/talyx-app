import { create } from 'zustand'
import { moduleIdOf } from '@features/modules/store'
import type { ModuleView } from '@features/modules/store'
import { mayLeave } from '@features/modules/leaveGuard'

export type AppView = 'agents' | 'settings' | ModuleView

interface NavigationState {
  currentView: AppView
  // The page Settings was opened from, where closing Settings goes back to.
  settingsFrom: AppView
  /**
   * Goes to `view`; leaving a module page first asks the page, which may keep the user there.
   * Resolves true once the view moved, false when the user stayed.
   */
  navigate: (view: AppView) => Promise<boolean>
  /** Leaves Settings for the page it was opened from (the agents keep their open chat). */
  closeSettings: () => Promise<boolean>
  /** Opens Settings, or closes it when it is open: the gear and ⌘,. */
  toggleSettings: () => Promise<boolean>
}

export const useNavigation = create<NavigationState>((set, get) => ({
  currentView: 'agents',
  settingsFrom: 'agents',
  navigate: async (view) => {
    const from = get().currentView
    const move = (): void =>
      set(
        view === 'settings' && from !== 'settings'
          ? { currentView: view, settingsFrom: from }
          : { currentView: view }
      )
    if (view === from || !moduleIdOf(from)) {
      move()
      return true
    }
    const allowed = await mayLeave()
    // The user may have gone elsewhere while the page asked; only the view it asked about moves.
    if (!allowed || get().currentView !== from) return false
    move()
    return true
  },
  closeSettings: async () => {
    const { currentView, settingsFrom, navigate } = get()
    return currentView === 'settings' ? navigate(settingsFrom) : false
  },
  toggleSettings: async () => {
    const { currentView, closeSettings, navigate } = get()
    return currentView === 'settings' ? closeSettings() : navigate('settings')
  }
}))
