import type { UiSurface } from '@contract/a2uiSurface'
import type { ChatItem } from './types'

export const LIVE_SURFACE_PREFIX = 'live-ui-'

export function liveSurfaceId(sourceId: string): string {
  return `${LIVE_SURFACE_PREFIX}${sourceId}`
}

function surfaceContentKey(surface: UiSurface): string {
  return JSON.stringify(surface)
}

/** Drop live surfaces once an equal stored surface is in history. */
export function mergeLiveSurfaces(stored: ChatItem[], live: ChatItem[]): ChatItem[] {
  const storedKeys = stored
    .filter((item): item is Extract<ChatItem, { kind: 'surface' }> => item.kind === 'surface')
    .map((item) => surfaceContentKey(item.surface))
  const remaining = [...storedKeys]
  const kept = live.filter((item) => {
    if (item.kind !== 'surface' || !item.id.startsWith(LIVE_SURFACE_PREFIX)) return false
    const key = surfaceContentKey(item.surface)
    const at = remaining.indexOf(key)
    if (at < 0) return true
    remaining.splice(at, 1)
    return false
  })
  return [...stored, ...kept]
}
