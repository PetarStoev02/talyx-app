import { useEffect, useState } from 'react'
import { Sparkle, FolderSync, Eye, Search, Zap, ChevronRight } from 'lucide-react'
import { cn } from '@shared/lib/utils'
import { Kbd } from '@shared/ui/kbd'
import { Tooltip, TooltipTrigger, TooltipContent } from '@shared/ui/tooltip'
import { type AppView, useNavigation } from '@app/providers/useNavigation'
import { useLanguage } from '@app/providers/useLanguage'
import { useWatchFolders } from '@app/providers/useWatchFolders'
import { useShell } from '@app/providers/useShell'
import { settingsApi, watchApi } from '@shared/api/ipc'
import type { TranslationKey } from '@shared/lib/i18n'
import { RecentSorts } from './RecentSorts'

const isMac = navigator.platform.toLowerCase().includes('mac')
const modKey = isMac ? '⌘' : 'Ctrl+'

interface NavItem {
  view: AppView
  labelKey: TranslationKey
  icon: React.ComponentType<{ className?: string }>
  shortcut: string
}

const askItem: NavItem = {
  view: 'ask',
  labelKey: 'nav.ask',
  icon: Sparkle,
  shortcut: `${modKey}1`
}

/** File tools. History lives under Recent sorts → See all. */
const fileItems: NavItem[] = [
  { view: 'sort', labelKey: 'nav.sort', icon: FolderSync, shortcut: `${modKey}2` },
  { view: 'watch', labelKey: 'nav.watch', icon: Eye, shortcut: `${modKey}3` },
  { view: 'search', labelKey: 'nav.search', icon: Search, shortcut: `${modKey}4` }
]

// Collapsed rail shows Ask + file tools (no History row — use Quick actions or See all).
const navItems: NavItem[] = [askItem, ...fileItems]

export function SidebarNav({ collapsed }: { collapsed: boolean }): React.JSX.Element {
  const currentView = useNavigation((s) => s.currentView)
  const navigate = useNavigation((s) => s.navigate)
  const t = useLanguage((s) => s.t)
  const watchFolders = useWatchFolders((s) => s.folders)
  const setWatchFolders = useWatchFolders((s) => s.setFolders)
  const openQuickActions = useShell((s) => s.openQuickActions)
  const [filesOpen, setFilesOpen] = useState(false)

  // Live counts: the sidebar owns the fetch so counts exist before any page mounts.
  // WatchPage does the same on its own mount — both write the shared store, idempotent.
  useEffect(() => {
    watchApi.list().then(setWatchFolders)
    return watchApi.onEvent(() => {
      watchApi.list().then(setWatchFolders)
    })
  }, [setWatchFolders])

  useEffect(() => {
    settingsApi.get().then((s) => setFilesOpen(s.filesGroupOpen))
  }, [])

  const watchCount = watchFolders.filter((f) => f.enabled).length
  const counts: Partial<Record<AppView, number>> = { watch: watchCount }

  if (collapsed) {
    return (
      <nav className="flex flex-col items-center gap-1 px-2">
        {navItems.map(({ view, labelKey, icon: Icon, shortcut }) => (
          <Tooltip key={view} delayDuration={300}>
            <TooltipTrigger asChild>
              <button
                onClick={() => navigate(view)}
                aria-label={t(labelKey)}
                className={cn(
                  'flex size-9 items-center justify-center rounded-md transition-colors',
                  currentView === view
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                )}
              >
                <Icon className="size-[18px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="flex items-center gap-2">
              {t(labelKey)}
              <kbd className="text-[10px] opacity-60">{shortcut}</kbd>
            </TooltipContent>
          </Tooltip>
        ))}
      </nav>
    )
  }

  function toggleFilesGroup(): void {
    const next = !filesOpen
    setFilesOpen(next)
    void settingsApi.set({ filesGroupOpen: next })
  }

  function renderRow({ view, labelKey, icon: Icon, shortcut }: NavItem): React.JSX.Element {
    const count = counts[view]
    return (
      <Tooltip key={view} delayDuration={600}>
        <TooltipTrigger asChild>
          <button
            onClick={() => navigate(view)}
            className={cn(
              'flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors',
              currentView === view
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="flex-1 truncate text-left">{t(labelKey)}</span>
            {count !== undefined && count > 0 && (
              <span className="text-[11px] text-muted-foreground">{count}</span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="flex items-center gap-2">
          {t(labelKey)}
          <kbd className="text-[10px] opacity-60">{shortcut}</kbd>
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <nav className="flex flex-col gap-0.5 px-2">
      <button
        onClick={openQuickActions}
        className="flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
      >
        <Zap className="size-4 shrink-0" />
        <span className="flex-1 truncate text-left">{t('sidebar.quickActions')}</span>
        <Kbd>{modKey}K</Kbd>
      </button>

      <div className="my-1.5 h-px bg-border/60" />

      {renderRow(askItem)}

      <div className="mt-1 flex flex-col gap-0.5">
        <button
          data-tour="files-group"
          onClick={toggleFilesGroup}
          aria-expanded={filesOpen}
          className="flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
        >
          <ChevronRight
            className={cn(
              'size-3.5 shrink-0 text-muted-foreground/80 transition-transform duration-150',
              filesOpen && 'rotate-90'
            )}
          />
          <span className="flex-1 truncate text-left font-medium">{t('nav.files')}</span>
        </button>

        {filesOpen && (
          <div className="ml-3 flex flex-col gap-0.5 border-l border-border/50 pl-2">
            {fileItems.map((item) => renderRow(item))}
            <RecentSorts />
          </div>
        )}
      </div>
    </nav>
  )
}
