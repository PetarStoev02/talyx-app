import type { ChatItem } from './types'

type SurfaceItem = Extract<ChatItem, { kind: 'surface' }>

/** React list key for a surface: its id plus which occurrence it is among surfaces with that id. */
export function surfaceListKey(items: ChatItem[], item: SurfaceItem): string {
  const surfaces = items.filter((row): row is SurfaceItem => row.kind === 'surface')
  const sameId = surfaces.filter((row) => row.surface.surfaceId === item.surface.surfaceId)
  const occurrence = sameId.findIndex((row) => row.id === item.id) + 1
  return `${item.surface.surfaceId}:${occurrence}`
}
