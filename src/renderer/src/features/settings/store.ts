import { create } from 'zustand'
import type { Theme } from '@contract/channels'
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

/** The Settings page that shows: SettingsNav sets it, openSettings opens Settings on it. */
interface SettingsSectionState {
  section: SettingsSection
  open: (section: SettingsSection) => void
}

export const useSettingsSection = create<SettingsSectionState>((set) => ({
  section: 'general',
  open: (section) => set({ section })
}))
