import { Bot, Bug, Settings, Sparkles } from 'lucide-react'
import { useLanguage } from '@app/providers/useLanguage'
import type { ReleaseInfo } from '@shared/hooks/useAutoUpdater'
import { NavButton } from './NavButton'

const isMac = navigator.platform.toLowerCase().includes('mac')
const mod = isMac ? '⌘' : 'Ctrl+'

/**
 * One row of icon buttons: the pages on the left, `end` (the roster's refresh) on the right.
 * Without a roster (no engine yet) the Agents page gets a button too, as the way back to it.
 */
export function SidebarFooter({
  release,
  withRoster,
  end
}: {
  release: ReleaseInfo | null
  withRoster: boolean
  end: React.ReactNode
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const label = release && t('nav.updateVersion').replace('{version}', release.version)

  return (
    <div className="flex flex-col gap-1 px-3 pt-3 pb-4">
      {release && (
        <button
          onClick={() => window.open(release.url, '_blank')}
          className="flex h-8 w-full items-center gap-2.5 rounded-full px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Sparkles className="size-4 shrink-0" />
          <span className="flex-1 truncate text-left">{label}</span>
        </button>
      )}
      <div className="flex items-center gap-1">
        {!withRoster && (
          <NavButton view="agents" labelKey="nav.agents" icon={Bot} shortcut={`${mod}1`} />
        )}
        <NavButton view="settings" labelKey="nav.settings" icon={Settings} shortcut={`${mod},`} />
        <NavButton view="engine-debug" labelKey="nav.engineDebug" icon={Bug} shortcut={`${mod}2`} />
        <span className="ml-auto">{end}</span>
      </div>
    </div>
  )
}
