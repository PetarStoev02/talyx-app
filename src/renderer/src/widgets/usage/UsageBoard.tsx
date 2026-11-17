import { useLanguage } from '@shared/lib/i18n'
import { botTitles } from '@features/bots/spread'
import { dailySeries, daysOf } from '@features/providers/usage'
import type { ProviderUsage, UsageReport } from '@features/providers/usage'
import { useUsageView } from '@features/providers/usageView'
import { TryAgain } from '@features/bots/ProblemMessage'
import { problemOf, problemText } from '@shared/lib/problem'
import { Loading, Skeleton } from '@shared/ui/skeleton'
import { BarList, DailyChart, type Bar } from './charts'
import { compact, requestsText, shareText, type Translate } from './format'

/** The report for the period: every provider together, or the one picked in the sidebar. */
export function UsageBoard({ onRetry }: { onRetry: () => void }): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const shown = useUsageView((s) => s.shown)
  const loading = useUsageView((s) => s.loading)
  const problem = useUsageView((s) => s.problem)
  const picked = useUsageView((s) => s.provider)

  if (problem) return <TryAgain problem={problemOf(problem)} onRetry={onRetry} />
  if (!shown)
    return (
      <Loading label={t('usage.loading')} className="space-y-3">
        <Skeleton className="h-16 w-48 rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        {[0, 1].map((row) => (
          <Skeleton key={row} className="h-14 w-full rounded-xl" />
        ))}
      </Loading>
    )

  // The last period stays on screen while the next loads, so nothing jumps or blanks. It is not
  // dimmed: that would drop the muted text under 4.5:1; aria-busy and the spinning refresh show it.
  const { report, days } = shown
  const provider = report.providers.find((item) => item.id === picked)
  return (
    <div aria-busy={loading} className="animate-arrive space-y-10">
      <p role="status" className="sr-only">
        {loading ? t('usage.updating') : ''}
      </p>
      {provider ? (
        <ProviderView report={report} provider={provider} days={days} t={t} />
      ) : (
        <AllProviders report={report} days={days} t={t} />
      )}
      {report.unread.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {t('usage.unread').replace('{bots}', botTitles(report.unread))}
        </p>
      )}
    </div>
  )
}

interface ViewProps {
  report: UsageReport
  days: number
  t: Translate
}

function AllProviders({ report, days, t }: ViewProps): React.JSX.Element {
  const pick = useUsageView((s) => s.pick)
  const bars = report.providers.map(
    (item): Bar => ({
      ...providerBar(item, report, days, t),
      onPick: () => pick(item.id)
    })
  )
  return (
    <>
      <Total tokens={report.total.tokens} requests={report.total.requests} t={t} />
      <DailySection report={report} providerId={null} days={days} t={t} />
      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-foreground">{t('usage.providers')}</h2>
        <BarList bars={bars} />
      </section>
      <ModelTable report={report} days={days} t={t} />
    </>
  )
}

function ProviderView({
  report,
  provider,
  days,
  t
}: ViewProps & { provider: ProviderUsage }): React.JSX.Element {
  const models = report.models.filter((model) => model.providerId === provider.id)
  return (
    <>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold wrap-break-word text-foreground">
          {provider.name ?? t('usage.unknown')}
        </h2>
        {provider.usage ? (
          <Total tokens={provider.usage.tokens} requests={provider.usage.requests} t={t} />
        ) : (
          <p className="text-base">{t('usage.none').replace('{days}', String(days))}</p>
        )}
        {provider.usage && provider.usage.tokens > 0 && (
          <p className="text-sm text-muted-foreground">
            {t('usage.shareOfAll').replace(
              '{percent}',
              shareText(provider.usage.tokens, report.total.tokens)
            )}
          </p>
        )}
      </div>
      {/* With nothing reported, the line above already says so; an empty chart would repeat it. */}
      {provider.usage && (
        <DailySection report={report} providerId={provider.id} days={days} t={t} />
      )}
      {models.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-foreground">{t('usage.breakdown')}</h2>
          <BarList
            bars={models.map((model) => ({
              key: model.model,
              label: model.model,
              value: model.tokens || null,
              figure: model.tokens ? compact(model.tokens) : requestsText(t, model.requests),
              detail: model.tokens
                ? `${t('usage.share').replace('{percent}', shareText(model.tokens, provider.usage?.tokens ?? 0))} · ${requestsText(t, model.requests)}`
                : null
            }))}
          />
        </section>
      )}
    </>
  )
}

// Tokens per day for one provider or all; without days (no plugin), why, and the rest still shows.
function DailySection({
  report,
  providerId,
  days,
  t
}: ViewProps & { providerId: string | null }): React.JSX.Element {
  const picked = report.days && daysOf(report.days, providerId)
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-foreground">{t('usage.daily')}</h2>
      {!picked ? (
        <p className="text-base">
          {t('usage.daysUnavailable').replace(
            '{reason}',
            problemText(t, problemOf(report.daysProblem))
          )}
        </p>
      ) : picked.every((point) => !point.tokens) ? (
        // A flat line on an empty scale says less than a sentence.
        <p className="text-base">{t('usage.dailyNone').replace('{days}', String(days))}</p>
      ) : (
        <DailyChart series={dailySeries(picked, { days, today: new Date() })} t={t} />
      )}
      {report.days && report.daysUnread.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {t('usage.daysUnread').replace('{bots}', botTitles(report.daysUnread))}
        </p>
      )}
    </section>
  )
}

function Total({
  tokens,
  requests,
  t
}: {
  tokens: number
  requests: number
  t: Translate
}): React.JSX.Element {
  // A provider that reports requests but no tokens has no token figure: lead with the requests.
  if (tokens === 0 && requests > 0)
    return (
      <p className="text-2xl font-semibold text-foreground tabular-nums">
        {requestsText(t, requests)}
      </p>
    )
  return (
    <div>
      <p className="text-2xl font-semibold text-foreground tabular-nums">{compact(tokens)}</p>
      <p className="text-base text-muted-foreground">
        {t('usage.totalTokens')} · {requestsText(t, requests)}
      </p>
    </div>
  )
}

// A provider's row: its tokens and share, only its requests when it reports no tokens, or none.
function providerBar(item: ProviderUsage, report: UsageReport, days: number, t: Translate): Bar {
  const usage = item.usage
  const share = usage?.tokens
    ? `${t('usage.share').replace('{percent}', shareText(usage.tokens, report.total.tokens))} · `
    : ''
  return {
    key: item.id,
    label: item.name ?? t('usage.unknown'),
    value: usage?.tokens || null,
    figure: usage?.tokens
      ? compact(usage.tokens)
      : usage
        ? requestsText(t, usage.requests)
        : t('usage.none').replace('{days}', String(days)),
    detail: usage?.tokens ? `${share}${requestsText(t, usage.requests)}` : null
  }
}

function ModelTable({ report, days, t }: ViewProps): React.JSX.Element {
  const models = report.models
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-foreground">{t('usage.breakdown')}</h2>
      {models.length === 0 ? (
        <p className="text-base">{t('usage.noModels').replace('{days}', String(days))}</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b border-foreground/10">
              <th className="py-2 pr-4 font-normal">{t('usage.model')}</th>
              <th className="py-2 pr-4 text-right font-normal whitespace-nowrap">
                {t('usage.requestsColumn')}
              </th>
              <th className="py-2 text-right font-normal whitespace-nowrap">
                {t('usage.tokensColumn')}
              </th>
            </tr>
          </thead>
          <tbody>
            {models.map((model) => (
              <tr
                key={`${model.providerId}:${model.model}`}
                className="border-b border-foreground/5"
              >
                <td className="py-2.5 pr-4">
                  <span className="block font-medium wrap-anywhere text-foreground">
                    {model.model}
                  </span>
                  <span className="block text-muted-foreground">
                    {model.provider ?? t('usage.unknown')}
                  </span>
                </td>
                <td className="py-2.5 pr-4 text-right whitespace-nowrap tabular-nums">
                  {compact(model.requests)}
                </td>
                <td className="py-2.5 text-right whitespace-nowrap text-foreground tabular-nums">
                  {model.tokens > 0 && compact(model.tokens)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
