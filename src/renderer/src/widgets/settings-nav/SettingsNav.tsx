import { useLanguage } from '@app/providers/useLanguage'
import { useModules } from '@features/modules/store'
import { settingsPages, shownPage, useSettingsSection } from '@features/settings/sections'
import { cn } from '@shared/lib/utils'

/**
 * Settings' own sidebar: one row per Settings page, the open one marked. It is marked
 * `data-module-sidebar`, so AppShell hides the roster behind it, as for a module's sidebar.
 */
export function SettingsNav(): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const open = useSettingsSection((s) => s.open)
  const licensed = useModules((s) => s.state.license !== null)
  const section = shownPage(
    useSettingsSection((s) => s.section),
    licensed
  )
  const pages = settingsPages(licensed)
  return (
    <div
      data-module-sidebar
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3"
    >
      <nav aria-label={t('settings.pages')} className="space-y-0.5 pt-1">
        {pages.map((item) => {
          const current = item.key === section
          return (
            <button
              key={item.key}
              type="button"
              aria-current={current ? 'page' : undefined}
              onClick={() => open(item.key)}
              className={cn(
                'flex w-full min-w-0 flex-col rounded-xl px-3 py-2 text-left transition-colors duration-150',
                current ? 'bg-foreground/10' : 'hover:bg-accent'
              )}
            >
              <span className="truncate text-base font-medium text-foreground">
                {t(item.title)}
              </span>
              <span className="truncate text-sm text-muted-foreground">{t(item.detail)}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
