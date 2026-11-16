import { useLanguage } from '@app/providers/useLanguage'
import { useNavigation } from '@app/providers/useNavigation'
import { useUsageView } from '@features/providers/usageView'
import { cn } from '@shared/lib/utils'
import { SidebarBack } from '@shared/ui/SidebarBack'

/**
 * Usage's own sidebar, like Settings': all providers, then each provider, the open one marked. It
 * is marked `data-module-sidebar`, so AppShell hides the roster behind it.
 */
export function UsageNav(): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const report = useUsageView((s) => s.shown?.report ?? null)
  const choice = useUsageView((s) => s.provider)
  const pick = useUsageView((s) => s.pick)
  const goBack = useNavigation((s) => s.goBack)
  // A provider that left the list (another period) shows All providers, as the page does.
  const picked = report?.providers.some((item) => item.id === choice) ? choice : null
  const rows = [
    { id: null, title: t('usage.allProviders') },
    ...(report?.providers ?? []).map((item) => ({
      id: item.id,
      title: item.name ?? t('usage.unknown')
    }))
  ]
  return (
    <div
      data-module-sidebar
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3"
    >
      <SidebarBack label={t('settings.back')} onClick={() => void goBack()} />
      <nav aria-label={t('usage.pages')} className="space-y-0.5 pt-1">
        {rows.map((row) => {
          const current = row.id === picked
          return (
            <button
              key={row.id ?? 'all'}
              type="button"
              aria-current={current ? 'page' : undefined}
              onClick={() => pick(row.id)}
              className={cn(
                'flex w-full min-w-0 rounded-xl px-3 py-2 text-left transition-colors duration-150',
                current ? 'bg-foreground/10' : 'hover:bg-accent'
              )}
            >
              {/* The full name shows on hover where the sidebar cuts it short. */}
              <span title={row.title} className="truncate text-base font-medium text-foreground">
                {row.title}
              </span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
