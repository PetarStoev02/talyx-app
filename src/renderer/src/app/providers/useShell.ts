import { create } from 'zustand'

interface ShellState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (v: boolean) => void
}

/** App shell chrome state: lives here so AppShell and the keyboard shortcuts hook share it */
export const useShell = create<ShellState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v })
}))
