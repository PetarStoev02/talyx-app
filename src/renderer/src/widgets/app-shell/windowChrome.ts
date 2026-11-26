export const isMac = (window.electron?.platform ?? 'darwin') === 'darwin'
export const dragRegion = { WebkitAppRegion: 'drag' } as React.CSSProperties
export const noDragRegion = { WebkitAppRegion: 'no-drag' } as React.CSSProperties

// The Layered rail owns the macOS window buttons (x16–68), with room before the panel's edge.
export const LAYERED_RAIL_PX = 88
