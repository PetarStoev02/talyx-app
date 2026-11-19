import { useEffect } from 'react'
import { create } from 'zustand'
import { settingsApi } from '@shared/api/ipc'
import { reportError } from '@shared/lib/report'

type ThemePreference = 'light' | 'dark' | 'system'
type EffectiveTheme = 'light' | 'dark'

const mq = window.matchMedia('(prefers-color-scheme: dark)')

function resolveTheme(pref: ThemePreference): EffectiveTheme {
  if (pref === 'system') return mq.matches ? 'dark' : 'light'
  return pref
}

// Transitions stay off for the frame the theme changes in, so every control repaints at once.
function applyTheme(effective: EffectiveTheme): void {
  const root = document.documentElement
  root.classList.add('theme-switching')
  root.classList.toggle('dark', effective === 'dark')
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')))
}

// Native chrome (menus, dialogs) following the theme is cosmetic: a failure is only logged.
function syncNative(pref: ThemePreference): void {
  window.api.setNativeTheme(pref).catch((error: unknown) => reportError('theme', error))
}

interface ThemeStore {
  theme: ThemePreference
  effectiveTheme: EffectiveTheme
  show: (pref: ThemePreference) => void
  reset: () => void
}

// One pick for every caller: a caller still on 'system' would repaint over another's pick when
// the OS appearance changes.
const useThemeStore = create<ThemeStore>((set) => ({
  theme: 'system',
  effectiveTheme: resolveTheme('system'),
  show: (pref) => {
    const effectiveTheme = resolveTheme(pref)
    applyTheme(effectiveTheme)
    set({ theme: pref, effectiveTheme })
  },
  reset: () => set({ theme: 'system', effectiveTheme: resolveTheme('system') })
}))

mq.addEventListener('change', () => {
  const { theme, show } = useThemeStore.getState()
  if (theme === 'system') show('system')
})

export function useTheme(): {
  theme: ThemePreference
  effectiveTheme: EffectiveTheme
  setTheme: (t: ThemePreference) => void
} {
  const theme = useThemeStore((s) => s.theme)
  const effectiveTheme = useThemeStore((s) => s.effectiveTheme)

  useEffect(() => {
    settingsApi
      .get()
      .then((s) => {
        const pref = s.theme ?? 'system'
        useThemeStore.getState().show(pref)
        syncNative(pref)
      })
      // Unreadable settings leave the system theme on screen; the log says why.
      .catch((error: unknown) => reportError('settings', error))
  }, [])

  return { theme, effectiveTheme, setTheme }
}

function setTheme(pref: ThemePreference): void {
  useThemeStore.getState().show(pref)
  settingsApi.save({ theme: pref })
  syncNative(pref)
}
