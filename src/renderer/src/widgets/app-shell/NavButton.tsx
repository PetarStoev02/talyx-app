import { cn } from '@shared/lib/utils'
import { Tooltip, TooltipTrigger, TooltipContent } from '@shared/ui/tooltip'
import { type AppView, useNavigation } from '@app/providers/useNavigation'
import { useLanguage } from '@app/providers/useLanguage'
import type { TranslationKey } from '@shared/lib/i18n'

interface NavButtonProps {
  view: AppView
  labelKey: TranslationKey
  icon: React.ComponentType<{ className?: string }>
  shortcut: string
  collapsed: boolean
}

/** One sidebar row; in the collapsed rail an icon with its label in a tooltip. */
export function NavButton({
  view,
  labelKey,
  icon: Icon,
  shortcut,
  collapsed
}: NavButtonProps): React.JSX.Element {
  const active = useNavigation((s) => s.currentView === view)
  const navigate = useNavigation((s) => s.navigate)
  const t = useLanguage((s) => s.t)
  const label = t(labelKey)

  return (
    <Tooltip delayDuration={collapsed ? 300 : 600}>
      <TooltipTrigger asChild>
        <button
          onClick={() => navigate(view)}
          aria-label={collapsed ? label : undefined}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'flex items-center rounded-md transition-colors',
            collapsed ? 'mx-auto size-9 justify-center' : 'h-8 w-full gap-2.5 px-2 text-[13px]',
            active
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
          )}
        >
          <Icon className={cn('shrink-0', collapsed ? 'size-[18px]' : 'size-4')} />
          {!collapsed && <span className="flex-1 truncate text-left">{label}</span>}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="flex items-center gap-2">
        {label}
        <kbd className="text-[10px] opacity-60">{shortcut}</kbd>
      </TooltipContent>
    </Tooltip>
  )
}
