import { create } from 'zustand'
import type { ModuleView } from '@features/modules/store'

export type AppView = 'agents' | 'settings' | ModuleView

interface NavigationState {
  currentView: AppView
  navigate: (view: AppView) => void
}

export const useNavigation = create<NavigationState>((set) => ({
  currentView: 'agents',
  navigate: (view) => set({ currentView: view })
}))
