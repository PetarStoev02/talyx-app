import { create } from 'zustand'

export type AppView = 'office'

interface NavigationState {
  currentView: AppView
  navigate: (view: AppView) => void
}

export const useNavigation = create<NavigationState>((set) => ({
  currentView: 'office',
  navigate: (view) => set({ currentView: view })
}))
