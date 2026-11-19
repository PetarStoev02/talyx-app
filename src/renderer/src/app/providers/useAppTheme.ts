import { loadTheme } from '@features/settings/theme'
import { useThemePick } from '@features/settings/store'
import { themeApi } from '@shared/api/ipc'
import { usePaintTheme } from '@shared/hooks/useTheme'
import { useOnMount } from '@shared/hooks/useSubscription'
import { reportError } from '@shared/lib/report'

/** Reads the saved theme once and paints the window in the pick. */
export function useAppTheme(): 'light' | 'dark' {
  const theme = useThemePick((s) => s.theme)
  useOnMount(() => {
    // Unreadable settings leave the system theme on screen; the log says why.
    loadTheme(themeApi).catch((error: unknown) => reportError('settings', error))
  })
  return usePaintTheme(theme)
}
