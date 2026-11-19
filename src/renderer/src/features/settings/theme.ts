import type { Theme } from '@contract/channels'
import type { PageSettings } from '@contract/settings'
import { useThemePick } from './store'

/** Where the pick is saved: the app's settings. */
export interface ThemeBackend {
  get: () => Promise<Pick<PageSettings, 'theme'>>
  save: (change: { theme: Theme }) => void
}

/** Reads the saved pick, unless the user picked while it was being read. */
export async function loadTheme(backend: ThemeBackend): Promise<void> {
  const { theme } = await backend.get()
  if (useThemePick.getState().picked) return
  useThemePick.setState({ theme: theme ?? 'system' })
}

/** Shows the pick at once and saves it. */
export function pickTheme(backend: ThemeBackend, theme: Theme): void {
  useThemePick.setState({ theme, picked: true })
  backend.save({ theme })
}
