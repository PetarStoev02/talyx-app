import { create } from 'zustand'
import { moduleIdOf } from '@features/modules/store'
import type { ModuleView } from '@features/modules/store'
import { mayLeave } from '@features/modules/leaveGuard'

export type AppView = 'agents' | 'settings' | ModuleView

interface NavigationState {
  currentView: AppView
  /**
   * Goes to `view`; leaving a module page first asks the page, which may keep the user there.
   * Resolves true once the view moved, false when the user stayed.
   */
  navigate: (view: AppView) => Promise<boolean>
}

export const useNavigation = create<NavigationState>((set, get) => ({
  currentView: 'agents',
  navigate: async (view) => {
    const from = get().currentView
    if (view === from || !moduleIdOf(from)) {
      set({ currentView: view })
      return true
    }
    const allowed = await mayLeave()
    // The user may have gone elsewhere while the page asked; only the view it asked about moves.
    if (!allowed || get().currentView !== from) return false
    set({ currentView: view })
    return true
  }
}))
