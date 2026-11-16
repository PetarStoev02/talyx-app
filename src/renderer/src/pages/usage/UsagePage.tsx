import { useCallback, useEffect } from 'react'
import { RotateCw } from 'lucide-react'
import { useLanguage } from '@app/providers/useLanguage'
import { useNavigation } from '@app/providers/useNavigation'
import type { ProvidersBackend } from '@features/providers/providers'
import { USAGE_PERIODS } from '@features/providers/usage'
import { useUsageView } from '@features/providers/usageView'
import { reportError } from '@shared/lib/report'
import { cn } from '@shared/lib/utils'
import { IconButton } from '@shared/ui/IconButton'
import { EngineGate } from '@widgets/engine-gate'
import { UsageBoard } from '@widgets/usage'

// The same column as Settings: wide enough to use a big window, narrow enough to read.
const COLUMN = 'mx-auto w-full max-w-4xl px-8'

/** What every bot used over a recent period; its sidebar picks all providers or one. */
export function UsagePage({
  providers
}: {
  providers: ProvidersBackend | null
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const goBack = useNavigation((s) => s.goBack)
  const days = useUsageView((s) => s.days)
  const setDays = useUsageView((s) => s.setDays)
  const loading = useUsageView((s) => s.loading)

  const load = useCallback((): void => {
    if (!providers) return
    useUsageView
      .getState()
      .load(providers)
      .catch((error: unknown) => reportError('usage', error))
  }, [providers])

  // Opening the page and each period load afresh, so the numbers are current.
  useEffect(load, [load, days])

  // Escape leaves Usage, unless a dialog or menu already took it (they mark it handled).
  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.preventDefault()
      void goBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goBack])

  return (
    <div className="flex h-full flex-col">
      <header className="h-14 shrink-0" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <h1 className="sr-only">{t('usage.title')}</h1>
        {/* Back is in the sidebar; the period sits where Settings has nothing. */}
        <div className={cn(COLUMN, 'flex h-full items-center justify-end')}>
          <div
            className="flex items-center gap-1"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <div
              role="group"
              aria-label={t('usage.period')}
              className="flex gap-0.5 rounded-full bg-secondary p-1"
            >
              {USAGE_PERIODS.map((period) => (
                <button
                  key={period}
                  aria-pressed={days === period}
                  onClick={() => setDays(period)}
                  className={cn(
                    'h-7 rounded-full px-3 text-sm font-medium transition-colors',
                    days === period
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t('usage.days').replace('{count}', String(period))}
                </button>
              ))}
            </div>
            <IconButton label={t('usage.refresh')} onClick={load}>
              <RotateCw className={cn(loading && 'motion-safe:animate-spin')} />
            </IconButton>
          </div>
        </div>
      </header>
      <div className="scroll-y-stable min-h-0 flex-1">
        <div className={cn(COLUMN, 'py-6')}>
          <EngineGate>{providers && <UsageBoard onRetry={load} />}</EngineGate>
        </div>
      </div>
    </div>
  )
}
