import { beforeEach, describe, expect, it } from 'vitest'
import type { Theme } from '../../../src/shared/channels'
import { useThemePick } from '../../../src/renderer/src/features/settings/store'
import {
  loadTheme,
  pickTheme,
  type ThemeBackend
} from '../../../src/renderer/src/features/settings/theme'

// The saved settings, as main keeps them; `read` holds the read open until the test lets it go.
function settingsWith(theme: Theme | null): {
  backend: ThemeBackend
  saved: Theme[]
  release: () => void
} {
  const saved: Theme[] = []
  let release = (): void => undefined
  const opened = new Promise<void>((resolve) => (release = resolve))
  return {
    saved,
    release: () => release(),
    backend: {
      get: async () => {
        await opened
        return theme === null ? {} : { theme }
      },
      save: ({ theme: next }) => void saved.push(next)
    }
  }
}

describe('theme', () => {
  beforeEach(() => useThemePick.getState().reset())

  describe('loadTheme', () => {
    it('should show the saved pick', async () => {
      const settings = settingsWith('dark')
      settings.release()
      await loadTheme(settings.backend)
      expect(useThemePick.getState().theme).toBe('dark')
    })

    it('should follow the system when nothing is saved', async () => {
      useThemePick.setState({ theme: 'light' })
      const settings = settingsWith(null)
      settings.release()
      await loadTheme(settings.backend)
      expect(useThemePick.getState().theme).toBe('system')
    })

    it('should keep a pick made while the saved one was being read', async () => {
      const settings = settingsWith('light')
      const loading = loadTheme(settings.backend)
      pickTheme(settings.backend, 'dark')
      settings.release()
      await loading
      expect(useThemePick.getState().theme).toBe('dark')
    })
  })

  describe('pickTheme', () => {
    it('should show and save the pick', () => {
      const settings = settingsWith(null)
      pickTheme(settings.backend, 'dark')
      expect(useThemePick.getState().theme).toBe('dark')
      expect(settings.saved).toEqual(['dark'])
    })
  })
})
