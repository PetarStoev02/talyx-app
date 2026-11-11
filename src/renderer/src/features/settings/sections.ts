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

/** The pages someone sees: Modules only with a license, as Settings → Modules always was. */
export function settingsPages(licensed: boolean): typeof SETTINGS_SECTIONS {
  return SETTINGS_SECTIONS.filter((item) => item.key !== 'modules' || licensed)
}

/**
 * The page Settings shows: the chosen one while it is there, else General. Removing or outliving
 * the license while on Modules leaves the page in place but gone from the sidebar.
 */
export function shownPage(section: SettingsSection, licensed: boolean): SettingsSection {
  return settingsPages(licensed).some((item) => item.key === section) ? section : 'general'
}

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
