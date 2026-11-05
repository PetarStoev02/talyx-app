import { useState, useEffect, useCallback } from 'react'
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

export function useTheme(): {
  theme: ThemePreference
  effectiveTheme: EffectiveTheme
  setTheme: (t: ThemePreference) => void
} {
  const [theme, setThemeState] = useState<ThemePreference>('system')
  const [effectiveTheme, setEffectiveTheme] = useState<EffectiveTheme>(() => resolveTheme('system'))

  // Load persisted preference on mount
  useEffect(() => {
    settingsApi
      .get()
      .then((s) => {
        const pref = s.theme ?? 'system'
        setThemeState(pref)
        const resolved = resolveTheme(pref)
        setEffectiveTheme(resolved)
        applyTheme(resolved)
        syncNative(pref)
      })
      // Unreadable settings leave the system theme on screen; the log says why.
      .catch((error: unknown) => reportError('settings', error))
  }, [])

  // Listen for OS preference changes when in 'system' mode
  useEffect(() => {
    if (theme !== 'system') return

    const handler = (e: MediaQueryListEvent): void => {
      const resolved: EffectiveTheme = e.matches ? 'dark' : 'light'
      setEffectiveTheme(resolved)
      applyTheme(resolved)
    }

    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  const setTheme = useCallback((pref: ThemePreference) => {
    setThemeState(pref)
    const resolved = resolveTheme(pref)
    setEffectiveTheme(resolved)
    applyTheme(resolved)
    settingsApi.save({ theme: pref })
    syncNative(pref)
  }, [])

  return { theme, effectiveTheme, setTheme }
}
