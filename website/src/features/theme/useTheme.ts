import { useState, useEffect, useCallback } from 'react'

export type Theme = 'system' | 'light' | 'dark'
type EffectiveTheme = 'light' | 'dark'

const STORAGE_KEY = 'talyx-theme'

function getSystemTheme(): EffectiveTheme {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(effective: EffectiveTheme): void {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', effective)
}

export function useTheme(): {
  theme: Theme
  effectiveTheme: EffectiveTheme
  setTheme: (t: Theme) => void
} {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system'
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
    return 'system'
  })

  const [systemTheme, setSystemTheme] = useState<EffectiveTheme>(getSystemTheme)

  const effectiveTheme: EffectiveTheme = theme === 'system' ? systemTheme : theme

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    localStorage.setItem(STORAGE_KEY, t)
    const effective = t === 'system' ? getSystemTheme() : t
    applyTheme(effective)
  }, [])

  useEffect(() => {
    applyTheme(effectiveTheme)
  }, [effectiveTheme])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent): void => {
      setSystemTheme(e.matches ? 'dark' : 'light')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return { theme, effectiveTheme, setTheme }
}
