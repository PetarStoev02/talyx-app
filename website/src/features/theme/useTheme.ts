import { useState, useEffect, useCallback } from 'react'

export type Theme = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'talyx-theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

// Storage can be blocked (privacy settings, sandboxed frames) and then throws on access; the
// theme then follows the system, and a choice in the switcher is not remembered.
function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    return 'system'
  }
}

function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Blocked storage: the choice applies now but is not remembered.
  }
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
    storeTheme(t)
    applyTheme(t)
  }, [])

  return { theme, setTheme }
}
