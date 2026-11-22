import type { ChatItem } from './types'

export const LIVE_SURFACE_PREFIX = 'live-ui-'

export function liveSurfaceId(sourceId: string): string {
  return `${LIVE_SURFACE_PREFIX}${sourceId}`
}

/** Drop live surfaces once the same surfaceId is stored in history. */
export function mergeLiveSurfaces(stored: ChatItem[], live: ChatItem[]): ChatItem[] {
  const storedIds = new Set(
    stored
      .filter((item): item is Extract<ChatItem, { kind: 'surface' }> => item.kind === 'surface')
      .map((item) => item.surface.surfaceId)
  )
  const kept = live.filter((item) => {
    if (item.kind !== 'surface' || !item.id.startsWith(LIVE_SURFACE_PREFIX)) return false
    return !storedIds.has(item.surface.surfaceId)
  })
  return [...stored, ...kept]
}
