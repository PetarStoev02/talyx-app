import { useCallback, useEffect } from 'react'
import { RotateCw } from 'lucide-react'
import { useEscape } from '@shared/hooks/useEscape'
import { useLanguage } from '@shared/lib/i18n'
import { useNavigation } from '@features/modules/useNavigation'
import type { ProvidersBackend } from '@features/providers/providers'
import { USAGE_PERIODS } from '@features/providers/usage'
import { useUsageView } from '@features/providers/usageView'
import type { SetupBackend } from '@features/setup/install'
import { reportError } from '@shared/lib/report'
import { cn } from '@shared/lib/utils'
import { IconButton } from '@shared/ui/IconButton'
import { EngineGate } from '@widgets/engine-gate'
import { UsageBoard } from '@widgets/usage'

// The same column as Settings: wide enough to use a big window, narrow enough to read.
const COLUMN = 'mx-auto w-full max-w-4xl px-8'

/** What every bot used over a recent period; its sidebar picks all providers or one. */
export function UsagePage({
  providers,
  setup
}: {
  providers: ProvidersBackend | null
  setup: SetupBackend
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const goBack = useNavigation((s) => s.goBack)
  const leave = useCallback((): void => void goBack(), [goBack])
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

  // Escape leaves the page, unless a dialog or menu already took it.
  useEscape(leave)

  return (
    <div className="flex h-full flex-col">
      <header
        className="min-h-14 shrink-0"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <h1 className="sr-only">{t('usage.title')}</h1>
        {/* Back is in the sidebar; the period sits where Settings has nothing. */}
        <div className={cn(COLUMN, 'flex min-h-14 flex-wrap items-center justify-end-safe gap-1')}>
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
                  type="button"
                  key={period}
                  aria-pressed={days === period}
                  onClick={() => setDays(period)}
                  className={cn(
                    'h-7 rounded-full px-3 text-sm font-medium whitespace-nowrap transition-colors',
                    days === period
                      ? 'bg-foreground text-background'
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
          <EngineGate setup={setup}>{providers && <UsageBoard onRetry={load} />}</EngineGate>
        </div>
      </div>
    </div>
  )
}
