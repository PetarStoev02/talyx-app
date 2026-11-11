import { describe, expect, it } from 'vitest'
import {
  SETTINGS_SECTIONS,
  settingsPages,
  shownPage,
  type SettingsSection
} from '../../../src/renderer/src/features/settings/sections'

const keys = (licensed: boolean): SettingsSection[] =>
  settingsPages(licensed).map((page) => page.key)

describe('Settings pages', () => {
  describe('which pages show', () => {
    it('should list every page, Modules included, with a license', () => {
      expect(keys(true)).toEqual(SETTINGS_SECTIONS.map((page) => page.key))
    })

    it('should leave Modules out without a license', () => {
      expect(keys(false)).toEqual(['general', 'providers', 'engine', 'about'])
    })
  })

  describe('which page is open', () => {
    it.each(SETTINGS_SECTIONS.map((page) => page.key))(
      'should keep %s open while it is listed',
      (section) => {
        expect(shownPage(section, true)).toBe(section)
      }
    )

    it('should fall back to General when the license goes while Modules is open', () => {
      expect(shownPage('modules', false)).toBe('general')
    })

    it('should keep any other page open without a license', () => {
      expect(shownPage('engine', false)).toBe('engine')
    })
  })
})
