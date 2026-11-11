import { type AppView, useNavigation } from '@app/providers/useNavigation'
import { PageGlyph, type PageGlyphName } from './PageGlyph'
import { IconButton } from '@shared/ui/IconButton'

interface NavButtonProps {
  view: AppView
  label: string
  // Talyx's mark for the agents; a module's glyph otherwise.
  glyph: PageGlyphName
  shortcut?: string
}

/**
 * A footer dock button that opens a page, named by its tooltip. Its glyph is always in colour;
 * the dock's sliding disc (DockIndicator) marks the open page, so the button stays transparent.
 */
export function NavButton({ view, label, glyph, shortcut }: NavButtonProps): React.JSX.Element {
  const active = useNavigation((s) => s.currentView === view)
  const navigate = useNavigation((s) => s.navigate)
  return (
    <IconButton
      label={label}
      shortcut={shortcut}
      aria-current={active ? 'page' : undefined}
      onClick={() => navigate(view)}
      className="relative z-10 size-8 transition-[opacity,scale] duration-150 ease-out enabled:active:scale-[0.96] hover:bg-transparent hover:opacity-75 aria-[current=page]:hover:opacity-100"
    >
      <PageGlyph name={glyph} size={20} />
    </IconButton>
  )
}
