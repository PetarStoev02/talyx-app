// Settings as separate pages, one per row of its sidebar (SettingsNav). The sidebar sets the open
// page; the Settings page shows only that one.
import { create } from 'zustand'
import type { TranslationKey } from '@shared/lib/i18n'

export type SettingsSection = 'general' | 'providers' | 'engine' | 'modules' | 'about'

export const SETTINGS_SECTIONS: {
  key: SettingsSection
  title: TranslationKey
  detail: TranslationKey
}[] = [
  { key: 'general', title: 'settings.general', detail: 'settings.generalDetail' },
  { key: 'providers', title: 'providers.title', detail: 'settings.providersDetail' },
  { key: 'engine', title: 'settings.engine', detail: 'settings.engineDetail' },
  { key: 'modules', title: 'modules.title', detail: 'settings.modulesDetail' },
  { key: 'about', title: 'settings.about', detail: 'settings.aboutDetail' }
]

interface SettingsSectionState {
  section: SettingsSection
  open: (section: SettingsSection) => void
}

export const useSettingsSection = create<SettingsSectionState>((set) => ({
  section: 'general',
  open: (section) => set({ section })
}))

/** Opens Settings on one page; `navigate` is the app's (features cannot reach it themselves). */
export function openSettings(
  section: SettingsSection,
  navigate: (view: 'settings') => Promise<boolean>
): void {
  useSettingsSection.getState().open(section)
  void navigate('settings')
}
