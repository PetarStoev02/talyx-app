import { create } from 'zustand'
import { moduleIdOf } from '@features/modules/store'
import type { ModuleView } from '@features/modules/store'
import { mayLeave } from '@features/modules/leaveGuard'

/** Pages opened over the others from the footer; closing one goes back to where it was opened. */
const FOOTER_VIEWS = ['settings', 'usage'] as const
export type FooterView = (typeof FOOTER_VIEWS)[number]
export type AppView = 'agents' | FooterView | ModuleView

function isFooterView(view: AppView): view is FooterView {
  return (FOOTER_VIEWS as readonly AppView[]).includes(view)
}

interface NavigationState {
  currentView: AppView
  // The page Settings or Usage was opened from, where closing it goes back to.
  returnTo: AppView
  /**
   * Goes to `view`; leaving a module page first asks the page, which may keep the user there.
   * Resolves true once the view moved, false when the user stayed.
   */
  navigate: (view: AppView) => Promise<boolean>
  /** Leaves Settings or Usage for the page it was opened from (the agents keep their open chat). */
  goBack: () => Promise<boolean>
  /** Opens Settings or Usage, or closes it when it is open: the footer buttons and ⌘,. */
  toggle: (view: FooterView) => Promise<boolean>
}

export const useNavigation = create<NavigationState>((set, get) => ({
  currentView: 'agents',
  returnTo: 'agents',
  navigate: async (view) => {
    const from = get().currentView
    const move = (): void =>
      set(
        isFooterView(view) && !isFooterView(from)
          ? { currentView: view, returnTo: from }
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
  goBack: async () => {
    const { currentView, returnTo, navigate } = get()
    return isFooterView(currentView) ? navigate(returnTo) : false
  },
  toggle: async (view) => {
    const { currentView, goBack, navigate } = get()
    return currentView === view ? goBack() : navigate(view)
  }
}))
