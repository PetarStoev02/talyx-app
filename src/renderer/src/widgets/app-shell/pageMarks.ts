// The open page's mark beside its glyph. The disc behind the glyph is a tone step on the ground,
// too faint (1.1:1) to carry the state alone, so a bar in the foreground carries it too.

/** Under the glyph, in the footer's dock. */
export const DOCK_MARK =
  'relative after:pointer-events-none after:absolute after:bottom-0.5 after:left-1/2 after:h-0.5 after:w-2.5 after:-translate-x-1/2 after:rounded-full after:bg-foreground after:opacity-0 aria-[current=page]:after:opacity-100'

/** At the rail's leading edge, whatever the button's size: the rail sets `--rail` to its width. */
export const RAIL_MARK =
  'relative after:pointer-events-none after:absolute after:top-1/2 after:left-[calc((100%-var(--rail))/2)] after:h-4 after:w-[3px] after:-translate-y-1/2 after:rounded-r-full after:bg-foreground after:opacity-0 aria-[current=page]:after:opacity-100'
