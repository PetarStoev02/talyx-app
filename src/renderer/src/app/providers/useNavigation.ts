import { create } from 'zustand'

export type AppView = 'agents' | 'engine-debug' | 'settings'

interface NavigationState {
  currentView: AppView
  navigate: (view: AppView) => void
}

export const useNavigation = create<NavigationState>((set) => ({
  currentView: 'agents',
  navigate: (view) => set({ currentView: view })
}))
