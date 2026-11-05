import { Settings, Sparkles } from 'lucide-react'
import { cn } from '@shared/lib/utils'
import { Tooltip, TooltipTrigger, TooltipContent } from '@shared/ui/tooltip'
import { useLanguage } from '@app/providers/useLanguage'
import type { ReleaseInfo } from '@shared/hooks/useAutoUpdater'
import { NavButton } from './NavButton'

const isMac = navigator.platform.toLowerCase().includes('mac')

export function SidebarFooter({
  collapsed,
  release
}: {
  collapsed: boolean
  release: ReleaseInfo | null
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)

  return (
    <div className="flex flex-col gap-0.5 px-2 pb-2">
      {release && (
        <UpdateButton
          collapsed={collapsed}
          label={t('nav.updateVersion').replace('{version}', release.version)}
          onOpen={() => window.open(release.url, '_blank')}
        />
      )}
      <NavButton
        view="settings"
        labelKey="nav.settings"
        icon={Settings}
        shortcut={isMac ? '⌘,' : 'Ctrl+,'}
        collapsed={collapsed}
      />
    </div>
  )
}

function UpdateButton({
  collapsed,
  label,
  onOpen
}: {
  collapsed: boolean
  label: string
  onOpen: () => void
}): React.JSX.Element {
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <button
          onClick={onOpen}
          aria-label={collapsed ? label : undefined}
          className={cn(
            'flex items-center rounded-full text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground',
            collapsed ? 'mx-auto size-9 justify-center' : 'h-8 w-full gap-2.5 px-2 text-[13px]'
          )}
        >
          <Sparkles className={cn('shrink-0', collapsed ? 'size-[18px]' : 'size-4')} />
          {!collapsed && <span className="flex-1 truncate text-left">{label}</span>}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}
