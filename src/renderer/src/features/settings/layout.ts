import type { SidebarLayout } from '@contract/channels'
import type { PageSettings } from '@contract/settings'
import { useLayoutPick } from './store'

/** Where the pick is saved: the app's settings. */
export interface LayoutBackend {
  get: () => Promise<Pick<PageSettings, 'sidebarLayout'>>
  save: (change: { sidebarLayout: SidebarLayout }) => void
}

/** Reads the saved pick, unless the user picked while it was being read. */
export async function loadLayout(backend: LayoutBackend): Promise<void> {
  const { sidebarLayout } = await backend.get()
  if (useLayoutPick.getState().picked) return
  useLayoutPick.setState({ layout: sidebarLayout ?? 'dock' })
}

/** Shows the pick at once and saves it. */
export function pickLayout(backend: LayoutBackend, layout: SidebarLayout): void {
  useLayoutPick.setState({ layout, picked: true })
  backend.save({ sidebarLayout: layout })
}
