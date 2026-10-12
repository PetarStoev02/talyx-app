import { useState, useEffect, useCallback } from 'react'
import { settingsApi } from '@shared/api/ipc'

type ThemePreference = 'light' | 'dark' | 'system'
type EffectiveTheme = 'light' | 'dark'

const mq = window.matchMedia('(prefers-color-scheme: dark)')

function resolveTheme(pref: ThemePreference): EffectiveTheme {
  if (pref === 'system') return mq.matches ? 'dark' : 'light'
  return pref
}

function applyTheme(effective: EffectiveTheme): void {
  document.documentElement.classList.toggle('dark', effective === 'dark')
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
    settingsApi.get().then((s) => {
      const pref = s.theme ?? 'system'
      setThemeState(pref)
      const resolved = resolveTheme(pref)
      setEffectiveTheme(resolved)
      applyTheme(resolved)
      window.api.setNativeTheme(pref)
    })
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
    settingsApi.set({ theme: pref })
    window.api.setNativeTheme(pref)
  }, [])

  return { theme, effectiveTheme, setTheme }
}
