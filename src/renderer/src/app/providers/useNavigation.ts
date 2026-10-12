import { create } from 'zustand'

export type AppView = 'ask' | 'sort' | 'watch' | 'history' | 'search' | 'settings'

export type SettingsSectionId =
  | 'assistant'
  | 'general'
  | 'appearance'
  | 'classification'
  | 'feedback'

interface NavigationState {
  currentView: AppView
  navigate: (view: AppView) => void
}

export const useNavigation = create<NavigationState>((set) => ({
  currentView: 'ask',
  navigate: (view) => set({ currentView: view })
}))
