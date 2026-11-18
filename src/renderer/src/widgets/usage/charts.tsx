import type { DayUsage } from '@features/providers/providers'
import { niceCeiling, smoothPath } from '@shared/lib/chartPath'
import { cn } from '@shared/lib/utils'
import { compact, dayLabel, requestsText, type Translate } from './format'

// The plot in SVG units; the SVG stretches to its box, so only the ratio matters.
const WIDTH = 1000
const HEIGHT = 240
const GRID_STEPS = [0, 0.5, 1]

/**
 * Tokens per day as a smooth area, oldest on the left, on a round scale with its gridlines labelled.
 * Hovering a day names it and its counts. Screen readers get the busiest day instead.
 */
export function DailyChart({ series, t }: { series: DayUsage[]; t: Translate }): React.JSX.Element {
  const peak = Math.max(...series.map((point) => point.tokens), 0)
  const top = niceCeiling(peak)
  const step = series.length > 1 ? WIDTH / (series.length - 1) : WIDTH
  const points = series.map((point, index) => ({
    x: series.length > 1 ? index * step : WIDTH / 2,
    y: HEIGHT - (point.tokens / top) * HEIGHT
  }))
  const line = smoothPath(points)
  const [first] = points
  const last = points.at(-1)
  const area = first && last ? `${line} L${last.x},${HEIGHT} L${first.x},${HEIGHT} Z` : ''
  const busiest = series.find((point) => point.tokens === peak && peak > 0)
  const summary = busiest
    ? t('usage.dailySummary')
        .replace('{day}', dayLabel(busiest.day))
        .replace('{tokens}', compact(peak))
    : t('usage.dailyEmpty')
  const middle = series[Math.floor(series.length / 2)]
  return (
    <figure className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
      {/* The scale, top to bottom, level with its gridlines. */}
      <div
        aria-hidden="true"
        className="relative h-48 w-10 text-right text-xs text-muted-foreground tabular-nums"
      >
        {GRID_STEPS.map((share) => (
          <span
            key={share}
            className="absolute right-0 -translate-y-1/2"
            style={{ top: `${(1 - share) * 100}%` }}
          >
            {compact(top * share)}
          </span>
        ))}
      </div>
      <div role="img" aria-label={summary} className="relative h-48 text-foreground">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="absolute inset-0 size-full overflow-visible"
        >
          <defs>
            <linearGradient id="usage-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {GRID_STEPS.map((share) => (
            <line
              key={share}
              x1={0}
              x2={WIDTH}
              y1={HEIGHT - share * HEIGHT}
              y2={HEIGHT - share * HEIGHT}
              stroke="currentColor"
              strokeOpacity={share === 0 ? 0.2 : 0.14}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path d={area} fill="url(#usage-area)" />
          <path
            d={line}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.85}
            strokeWidth={2}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {/* One hover target per day, each as wide as its share of the plot. */}
        <div className="absolute inset-0 flex">
          {series.map((point) => (
            <div
              key={point.day}
              title={`${dayLabel(point.day)}: ${t('usage.tokensDetail').replace('{count}', compact(point.tokens))} · ${requestsText(t, point.requests)}`}
              className="h-full flex-1 hover:bg-foreground/5"
            />
          ))}
        </div>
      </div>
      <span />
      <figcaption
        aria-hidden="true"
        className="flex justify-between text-xs tracking-wide text-muted-foreground uppercase tabular-nums"
      >
        <span>{series[0] && dayLabel(series[0].day)}</span>
        <span>{middle && dayLabel(middle.day)}</span>
        <span>{series.at(-1) && dayLabel(series.at(-1)!.day)}</span>
      </figcaption>
      {/* The days the chart names on hover, as a table for the keyboard and screen readers: quiet days left out. */}
      <details className="col-span-2 text-sm">
        <summary className="w-fit cursor-pointer text-muted-foreground hover:text-foreground">
          {t('usage.dailyTable')}
        </summary>
        <table className="mt-2 w-full text-left">
          <caption className="sr-only">{t('usage.daily')}</caption>
          <thead className="text-muted-foreground">
            <tr className="border-b border-foreground/10">
              <th scope="col" className="py-1.5 pr-4 font-normal">
                {t('usage.day')}
              </th>
              <th scope="col" className="py-1.5 pr-4 text-right font-normal">
                {t('usage.tokensColumn')}
              </th>
              <th scope="col" className="py-1.5 text-right font-normal">
                {t('usage.requestsColumn')}
              </th>
            </tr>
          </thead>
          <tbody>
            {series
              .filter((point) => point.tokens || point.requests)
              .map((point) => (
                <tr key={point.day} className="border-b border-foreground/5">
                  <th scope="row" className="py-1.5 pr-4 font-normal text-foreground">
                    {dayLabel(point.day)}
                  </th>
                  <td className="py-1.5 pr-4 text-right tabular-nums">{compact(point.tokens)}</td>
                  <td className="py-1.5 text-right tabular-nums">{compact(point.requests)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}

export interface Bar {
  key: string
  label: string
  /** The bar's length against the longest; null draws no bar (nothing reported). */
  value: number | null
  /** Right of the label: the figure, or why there is none. */
  figure: string
  detail: string | null
  onPick?: () => void
}

/** One row per item with a bar to scale, longest first as given; a row with `onPick` opens it. */
export function BarList({ bars }: { bars: Bar[] }): React.JSX.Element {
  const longest = Math.max(...bars.map((bar) => bar.value ?? 0), 0)
  return (
    <ul className="space-y-2">
      {bars.map((bar) => {
        const body = (
          <>
            <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="min-w-0 text-base font-medium wrap-break-word text-foreground">
                {bar.label}
              </span>
              <span
                className={cn(
                  'tabular-nums',
                  bar.value ? 'text-base font-medium text-foreground' : 'text-sm'
                )}
              >
                {bar.figure}
              </span>
            </span>
            {bar.detail && (
              <span className="mt-0.5 block text-sm text-muted-foreground">{bar.detail}</span>
            )}
            {bar.value ? (
              <span aria-hidden="true" className="mt-2 block h-1.5 rounded-full bg-foreground/10">
                <span
                  className="block h-full rounded-full bg-foreground/70"
                  style={{ width: `max(4px, ${(bar.value / longest) * 100}%)` }}
                />
              </span>
            ) : null}
          </>
        )
        return (
          <li key={bar.key}>
            {bar.onPick ? (
              <button
                type="button"
                onClick={bar.onPick}
                className="block w-full rounded-xl bg-secondary p-3 text-left transition-colors hover:bg-foreground/10"
              >
                {body}
              </button>
            ) : (
              <div className="rounded-xl bg-secondary p-3">{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
