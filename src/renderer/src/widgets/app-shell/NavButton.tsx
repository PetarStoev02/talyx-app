import { type AppView, useNavigation } from '@app/providers/useNavigation'
import { useLanguage } from '@app/providers/useLanguage'
import type { TranslationKey } from '@shared/lib/i18n'
import { IconButton } from '@shared/ui/IconButton'

interface NavButtonProps {
  view: AppView
  labelKey: TranslationKey
  icon: React.ComponentType
  shortcut: string
}

/** A footer button that opens a page: its icon, with the page's name in a tooltip. */
export function NavButton({
  view,
  labelKey,
  icon: Icon,
  shortcut
}: NavButtonProps): React.JSX.Element {
  const active = useNavigation((s) => s.currentView === view)
  const navigate = useNavigation((s) => s.navigate)
  const t = useLanguage((s) => s.t)
  return (
    <IconButton
      label={t(labelKey)}
      shortcut={shortcut}
      aria-current={active ? 'page' : undefined}
      onClick={() => navigate(view)}
      className={active ? 'bg-foreground/10 text-foreground' : undefined}
    >
      <Icon />
    </IconButton>
  )
}
