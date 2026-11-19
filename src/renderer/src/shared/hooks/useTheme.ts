import { useEffect, useSyncExternalStore } from 'react'
import type { Theme } from '@contract/channels'

type EffectiveTheme = 'light' | 'dark'

const systemDark = window.matchMedia('(prefers-color-scheme: dark)')

function subscribeToSystem(onChange: () => void): () => void {
  systemDark.addEventListener('change', onChange)
  return () => systemDark.removeEventListener('change', onChange)
}

// Transitions stay off for the frame the theme changes in, so every control repaints at once.
function paint(effective: EffectiveTheme): void {
  const root = document.documentElement
  root.classList.add('theme-switching')
  root.classList.toggle('dark', effective === 'dark')
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')))
}

/**
 * Paints the window in `theme`, following the OS appearance while it is 'system'. Call it once,
 * for the window: a second painter with its own theme would repaint over the first when the OS
 * appearance changes.
 */
export function usePaintTheme(theme: Theme): EffectiveTheme {
  const dark = useSyncExternalStore(subscribeToSystem, () => systemDark.matches)
  const effective: EffectiveTheme = theme === 'system' ? (dark ? 'dark' : 'light') : theme

  useEffect(() => paint(effective), [effective])

  return effective
}
