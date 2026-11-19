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
  // The user picked in this window; the stored pick, read later, must not undo that.
  picked: boolean
  applyPreference: (pref: ThemePreference) => void
  reset: () => void
}

// One pick for every caller: a caller still on 'system' would repaint over another's pick when
// the OS appearance changes.
const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: 'system',
  effectiveTheme: resolveTheme('system'),
  picked: false,
  applyPreference: (pref) => {
    const effectiveTheme = resolveTheme(pref)
    applyTheme(effectiveTheme)
    set({ theme: pref, effectiveTheme })
  },
  reset: () => {
    get().applyPreference('system')
    set({ picked: false })
  }
}))

mq.addEventListener('change', () => {
  const { theme, applyPreference } = useThemeStore.getState()
  if (theme === 'system') applyPreference('system')
})

// The stored pick is read once per window, whichever caller mounts first.
let loading: Promise<void> | null = null

function loadStoredPick(): Promise<void> {
  return settingsApi.get().then((s) => {
    if (useThemeStore.getState().picked) return
    const pref = s.theme ?? 'system'
    useThemeStore.getState().applyPreference(pref)
    syncNative(pref)
  })
}

export function useTheme(): {
  theme: ThemePreference
  effectiveTheme: EffectiveTheme
  setTheme: (t: ThemePreference) => void
} {
  const theme = useThemeStore((s) => s.theme)
  const effectiveTheme = useThemeStore((s) => s.effectiveTheme)

  useEffect(() => {
    // Unreadable settings leave the system theme on screen; the log says why.
    loading ??= loadStoredPick().catch((error: unknown) => reportError('settings', error))
  }, [])

  return { theme, effectiveTheme, setTheme }
}

function setTheme(pref: ThemePreference): void {
  useThemeStore.setState({ picked: true })
  useThemeStore.getState().applyPreference(pref)
  settingsApi.save({ theme: pref })
  syncNative(pref)
}
