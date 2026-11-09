import { type AppView, useNavigation } from '@app/providers/useNavigation'
import { IconButton } from '@shared/ui/IconButton'

interface NavButtonProps {
  view: AppView
  label: string
  icon: React.ComponentType
  shortcut?: string
}

/** A footer button that opens a page: its icon, with the page's name in a tooltip. */
export function NavButton({
  view,
  label,
  icon: Icon,
  shortcut
}: NavButtonProps): React.JSX.Element {
  const active = useNavigation((s) => s.currentView === view)
  const navigate = useNavigation((s) => s.navigate)
  return (
    <IconButton
      label={label}
      shortcut={shortcut}
      aria-current={active ? 'page' : undefined}
      onClick={() => navigate(view)}
      className={active ? 'bg-foreground/10 text-foreground' : undefined}
    >
      <Icon />
    </IconButton>
  )
}
