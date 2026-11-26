import { loadLayout } from '@features/settings/layout'
import { settingsApi } from '@shared/api/ipc'
import { useOnMount } from '@shared/hooks/useSubscription'
import { reportError } from '@shared/lib/report'

/** Reads the saved sidebar layout once, while the engine gate still stands before the app shell. */
export function useAppLayout(): void {
  useOnMount(() => {
    // Unreadable settings leave the dock on screen; the log says why.
    loadLayout(settingsApi).catch((error: unknown) => reportError('settings', error))
  })
}
