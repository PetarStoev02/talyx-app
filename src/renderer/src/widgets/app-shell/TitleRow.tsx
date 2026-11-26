import { TalyxLogo } from '@shared/ui/TalyxLogo'
import { dragRegion, isMac, noDragRegion } from './windowChrome'

/**
 * One 56px title row: the logo, then `end`. Where the macOS window buttons (x16–68) sit on this
 * row, the left padding clears them; the blank space drags the window.
 */
export function TitleRow({
  end,
  besideWindowButtons
}: {
  end: React.ReactNode
  // False when the window buttons sit elsewhere (the Layered rail).
  besideWindowButtons: boolean
}): React.JSX.Element {
  return (
    <div
      className={`mb-2 flex h-14 shrink-0 items-center gap-2.5 pr-3 ${isMac && besideWindowButtons ? 'pl-[92px]' : 'pl-4'}`}
      style={dragRegion}
    >
      <TalyxLogo size={18} className="text-foreground" />
      <span className="text-xs font-semibold text-foreground">Talyx</span>
      {/* Buttons in the title row must opt out of the window drag to take clicks. */}
      <span className="ml-auto flex items-center gap-1" style={noDragRegion}>
        {end}
      </span>
    </div>
  )
}
