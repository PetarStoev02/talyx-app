import { useState, useEffect, useCallback } from 'react'

export type Theme = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'talyx-theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

function readStoredTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : 'system'
}

function applyTheme(theme: Theme): void {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia(DARK_QUERY).matches)
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
}

/** index.html applies the stored theme before paint; this keeps it, and the switcher, in step. */
export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void } {
  // Starts as the prerendered HTML does, so hydration matches; the stored choice is read after.
  const [theme, setThemeState] = useState<Theme>('system')

  useEffect(() => {
    setThemeState(readStoredTheme())
    const mq = window.matchMedia(DARK_QUERY)
    const followSystem = (): void => {
      if (readStoredTheme() === 'system') applyTheme('system')
    }
    mq.addEventListener('change', followSystem)
    return () => mq.removeEventListener('change', followSystem)
  }, [])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    localStorage.setItem(STORAGE_KEY, t)
    applyTheme(t)
  }, [])

  return { theme, setTheme }
}
