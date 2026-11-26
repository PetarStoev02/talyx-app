import { create } from 'zustand'
import type { SidebarLayout, Theme } from '@contract/channels'
import type { SettingsSection } from './sections'

interface ThemePickState {
  theme: Theme
  /** The user picked in this window: the saved pick, read later, must not undo it. */
  picked: boolean
  reset: () => void
}

/** The window's one theme pick; theme.ts reads and saves it, the app paints it. */
export const useThemePick = create<ThemePickState>((set) => ({
  theme: 'system',
  picked: false,
  reset: () => set({ theme: 'system', picked: false })
}))

interface LayoutPickState {
  layout: SidebarLayout
  /** The user picked in this window: the saved pick, read later, must not undo it. */
  picked: boolean
  reset: () => void
}

/** The window's one sidebar layout pick; layout.ts reads and saves it, the app shell draws it. */
export const useLayoutPick = create<LayoutPickState>((set) => ({
  layout: 'dock',
  picked: false,
  reset: () => set({ layout: 'dock', picked: false })
}))

interface SettingsSectionState {
  section: SettingsSection
  open: (section: SettingsSection) => void
}

/** The Settings page that shows: SettingsNav sets it, openSettings opens Settings on it. */
export const useSettingsSection = create<SettingsSectionState>((set) => ({
  section: 'general',
  open: (section) => set({ section })
}))
