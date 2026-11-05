/** The sidebar's width in px: dragged between `min` and `max`, saved in settings.json. */
export const SIDEBAR_WIDTH = { min: 280, max: 480, initial: 320 } as const

/** A width within bounds; anything that is not a number (a hand-edited file) is the first one. */
export function clampSidebarWidth(width: unknown): number {
  if (typeof width !== 'number' || !Number.isFinite(width)) return SIDEBAR_WIDTH.initial
  return Math.round(Math.min(SIDEBAR_WIDTH.max, Math.max(SIDEBAR_WIDTH.min, width)))
}
