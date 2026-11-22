import { parseA2uiMessages, showUiMessagesFromTool } from '@contract/a2uiSurface'
import type { UiSurface } from '@contract/a2uiSurface'
import type { ChatItem } from './types'

export const LIVE_SURFACE_PREFIX = 'live-ui-'

export function liveSurfaceId(sourceId: string): string {
  return `${LIVE_SURFACE_PREFIX}${sourceId}`
}

/** A surface as text, so two copies of one interface compare equal. */
export function surfaceContentKey(surface: UiSurface): string {
  return JSON.stringify(surface)
}

/** The interface a tool call carries when it is a show_ui call Talyx would draw; null otherwise. */
export function showUiContent(name: string, args: Record<string, unknown>): string | null {
  const messages = showUiMessagesFromTool(name, args)
  const parsed = messages ? parseA2uiMessages(messages) : null
  return parsed?.ok ? surfaceContentKey(parsed.surface) : null
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
