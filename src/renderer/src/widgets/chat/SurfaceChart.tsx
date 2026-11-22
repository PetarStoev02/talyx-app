import { useState } from 'react'
import type { UiComponent } from '@contract/a2uiSurface'
import { niceCeiling } from '@shared/lib/chartPath'
import { useLanguage } from '@shared/lib/i18n'
import { cn } from '@shared/lib/utils'

type Chart = Extract<UiComponent, { component: 'Chart' }>

// The plot in SVG units; the SVG keeps this ratio, so text and corners never stretch.
const WIDTH = 640
const HEIGHT = 200
const LEFT = 44
const RIGHT = 4
const TOP = 10
const BOTTOM = 24
const PLOT_BOTTOM = HEIGHT - BOTTOM
const PLOT_HEIGHT = PLOT_BOTTOM - TOP
const GRID_STEPS = [0, 0.5, 1]
// A group of bars takes this share of its slot; the rest is the gap to the next group.
const GROUP_SHARE = 0.62
const BAR_MAX = 46
const BAR_GAP = 2
const BAR_RADIUS = 4
const MARKER_RADIUS = 3.5
// Past this many points a marker on each would crowd the line; the line alone reads better.
const MARKERS_UP_TO = 12
const AREA_OPACITY = 0.16
const TICK_SIZE = 11
const DONUT_SIZE = 148
const DONUT_OUTER = 70
const DONUT_INNER = 44
const COMPACT_FROM = 10_000
const FULL_TURN = Math.PI * 2
// Values already given as a percentage need no share beside them.
const PERCENT = '%'
const DIM_OPACITY = 0.35
const TOOLTIP_EDGE_INSET = 8
// The series colours, in order and never cycled (theme.css): a chart has four series at most.
const SERIES = ['text-chart-1', 'text-chart-2', 'text-chart-3', 'text-chart-4'] as const

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
const plain = new Intl.NumberFormat('en', { maximumFractionDigits: 2 })

/** A chart a bot put in its answer: bars, a line, an area or a pie, with what a reader needs to name each mark. */
export function SurfaceChart({ chart }: { chart: Chart }): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const [hover, setHover] = useState<number | null>(null)
  const [first] = chart.series
  const peak = Math.max(...chart.series.flatMap((series) => series.values), 0)
  const peakAt = first ? first.values.indexOf(Math.max(...first.values)) : -1
  const summary = t('chat.surfaceChartSummary')
    .replace('{series}', chart.series.map((series) => series.name).join(', '))
    .replace('{label}', chart.labels[peakAt] ?? '')
    .replace('{value}', amount(Math.max(...(first?.values ?? [0])), chart.unit))
  if (chart.kind === 'pie') return <Pie chart={chart} summary={summary} />
  const slot = slotWidth(chart)
  const hoverLeft =
    hover === null
      ? 0
      : Math.min(
          Math.max((slotCentre(chart, hover) / WIDTH) * 100, TOOLTIP_EDGE_INSET),
          100 - TOOLTIP_EDGE_INSET
        )
  return (
    <figure className="flex flex-col gap-2">
      {chart.series.length > 1 && (
        <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {chart.series.map((series, index) => (
            <span key={series.name} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cn('size-2 rounded-xs bg-current', SERIES[index])}
              />
              {series.name}
            </span>
          ))}
        </figcaption>
      )}
      <div className="relative">
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-sm"
            style={{ left: `${hoverLeft}%` }}
          >
            <MarkTooltip chart={chart} index={hover} />
          </div>
        )}
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={summary} className="w-full">
          <Grid top={niceCeiling(peak)} unit={chart.unit} />
          {chart.kind === 'bar' ? (
            <Bars chart={chart} hover={hover} />
          ) : (
            <Lines chart={chart} hover={hover} />
          )}
          {hover !== null && chart.kind !== 'bar' && (
            <line
              x1={slotCentre(chart, hover)}
              x2={slotCentre(chart, hover)}
              y1={TOP}
              y2={PLOT_BOTTOM}
              className="stroke-border"
              strokeWidth={1}
              pointerEvents="none"
            />
          )}
          {chart.labels.map((label, index) => (
            <text
              key={label}
              x={slotCentre(chart, index)}
              y={HEIGHT - 6}
              textAnchor="middle"
              fontSize={TICK_SIZE}
              className="fill-muted-foreground"
            >
              {label}
            </text>
          ))}
          <g>
            {chart.labels.map((_, index) => (
              <rect
                key={index}
                x={LEFT + slot * index}
                y={TOP}
                width={slot}
                height={PLOT_HEIGHT}
                fill="transparent"
                onPointerEnter={() => setHover(index)}
                onPointerLeave={() => setHover(null)}
              />
            ))}
          </g>
        </svg>
      </div>
    </figure>
  )
}

function MarkTooltip({ chart, index }: { chart: Chart; index: number }): React.JSX.Element {
  const label = chart.labels[index] ?? ''
  const many = chart.series.length > 1
  return (
    <div className="flex flex-col gap-1">
      <div className="font-medium">{label}</div>
      {chart.series.map((series, seriesIndex) => (
        <div key={series.name} className="flex items-center gap-1.5 tabular-nums">
          <span
            aria-hidden="true"
            className={cn('size-2 shrink-0 rounded-xs bg-current', SERIES[seriesIndex])}
          />
          {many && <span className="min-w-0 flex-1 truncate">{series.name}</span>}
          <span className={many ? '' : 'flex-1'}>
            {amount(series.values[index] ?? 0, chart.unit)}
          </span>
        </div>
      ))}
    </div>
  )
}

function Grid({ top, unit }: { top: number; unit: string | undefined }): React.JSX.Element {
  return (
    <g>
      {GRID_STEPS.map((share) => {
        const y = PLOT_BOTTOM - PLOT_HEIGHT * share
        return (
          <g key={share}>
            <line x1={LEFT} x2={WIDTH - RIGHT} y1={y} y2={y} className="stroke-border" />
            <text
              x={LEFT - 8}
              y={y + TICK_SIZE / 3}
              textAnchor="end"
              fontSize={TICK_SIZE}
              className="fill-muted-foreground tabular-nums"
            >
              {amount(top * share, tickUnit(unit))}
            </text>
          </g>
        )
      })}
    </g>
  )
}

function Bars({ chart, hover }: { chart: Chart; hover: number | null }): React.JSX.Element {
  const top = niceCeiling(Math.max(...chart.series.flatMap((series) => series.values), 0))
  const slot = slotWidth(chart)
  const count = chart.series.length
  const bar = Math.min(BAR_MAX, (slot * GROUP_SHARE - BAR_GAP * (count - 1)) / count)
  const group = bar * count + BAR_GAP * (count - 1)
  const dim = hover !== null
  return (
    <g>
      {chart.series.map((series, seriesIndex) => (
        <g key={series.name} className={SERIES[seriesIndex]}>
          {series.values.map((value, index) => {
            const height = (value / top) * PLOT_HEIGHT
            const x = slotCentre(chart, index) - group / 2 + seriesIndex * (bar + BAR_GAP)
            return (
              <path
                key={index}
                d={roundedTop({ x, y: PLOT_BOTTOM - height, width: bar, height })}
                className="fill-current"
                opacity={dim && hover !== index ? DIM_OPACITY : 1}
                pointerEvents="none"
              />
            )
          })}
        </g>
      ))}
    </g>
  )
}

function Lines({ chart, hover }: { chart: Chart; hover: number | null }): React.JSX.Element {
  const top = niceCeiling(Math.max(...chart.series.flatMap((series) => series.values), 0))
  return (
    <g pointerEvents="none">
      {chart.series.map((series, seriesIndex) => {
        const points = series.values.map((value, index) => ({
          x: slotCentre(chart, index),
          y: PLOT_BOTTOM - (value / top) * PLOT_HEIGHT
        }))
        const line = points.map((point) => `${point.x},${point.y}`).join(' ')
        const [start] = points
        const end = points.at(-1)
        return (
          <g key={series.name} className={SERIES[seriesIndex]}>
            {chart.kind === 'area' && start && end && (
              <polygon
                points={`${line} ${end.x},${PLOT_BOTTOM} ${start.x},${PLOT_BOTTOM}`}
                className="fill-current"
                opacity={AREA_OPACITY}
              />
            )}
            <polyline
              points={line}
              fill="none"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              className="stroke-current"
            />
            {points.map((point, index) => (
              // The ring in the card's colour keeps a marker apart from a line it sits on.
              <circle
                key={index}
                cx={point.x}
                cy={point.y}
                r={MARKER_RADIUS}
                strokeWidth={2}
                className="fill-current stroke-card"
                opacity={
                  points.length > MARKERS_UP_TO ? 0 : hover === null || hover === index ? 1 : 0.4
                }
              />
            ))}
          </g>
        )
      })}
    </g>
  )
}

// A pie's slices are its labels: each gets a series colour, and the list beside it names them.
function Pie({ chart, summary }: { chart: Chart; summary: string }): React.JSX.Element {
  const [hover, setHover] = useState<number | null>(null)
  const values = chart.series[0]?.values ?? []
  const total = values.reduce((sum, value) => sum + value, 0)
  const centre = DONUT_SIZE / 2
  // Where each slice ends, as a share of the whole; a slice starts where the one before ended.
  const ends = values.map((_, index) =>
    total > 0 ? values.slice(0, index + 1).reduce((sum, value) => sum + value, 0) / total : 0
  )
  return (
    <figure className="flex flex-wrap items-center gap-6">
      <div className="relative shrink-0">
        {hover !== null && (
          <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-sm">
            <PieTooltip chart={chart} index={hover} total={total} />
          </div>
        )}
        <svg
          viewBox={`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`}
          role="img"
          aria-label={summary}
          className="size-36"
        >
          {values.map((_, index) => {
            return (
              <path
                key={index}
                d={ring({ centre, from: ends[index - 1] ?? 0, to: ends[index] ?? 0 })}
                strokeWidth={2}
                className={cn('fill-current stroke-card', SERIES[index])}
                opacity={hover !== null && hover !== index ? DIM_OPACITY : 1}
                onPointerEnter={() => setHover(index)}
                onPointerLeave={() => setHover(null)}
              />
            )
          })}
        </svg>
      </div>
      <figcaption className="flex min-w-40 flex-1 flex-col gap-1.5 text-sm">
        {values.map((value, index) => (
          <span key={index} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={cn('size-2 rounded-xs bg-current', SERIES[index])}
            />
            <span className="flex-1">{chart.labels[index]}</span>
            <span className="text-muted-foreground tabular-nums">
              {amount(value, chart.unit)}
              {total > 0 && chart.unit !== PERCENT && ` · ${Math.round((value / total) * 100)}%`}
            </span>
          </span>
        ))}
      </figcaption>
    </figure>
  )
}

function PieTooltip({
  chart,
  index,
  total
}: {
  chart: Chart
  index: number
  total: number
}): React.JSX.Element {
  const value = chart.series[0]?.values[index] ?? 0
  const label = chart.labels[index] ?? ''
  const share = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="flex flex-col gap-0.5 tabular-nums">
      <div className="font-medium">{label}</div>
      <div>{amount(value, chart.unit)}</div>
      <div className="text-muted-foreground">{share}%</div>
    </div>
  )
}

function slotWidth(chart: Chart): number {
  return (WIDTH - LEFT - RIGHT) / chart.labels.length
}

function slotCentre(chart: Chart, index: number): number {
  return LEFT + slotWidth(chart) * (index + 0.5)
}

// A short unit ("k", "%") closes the number; a word ("tokens") follows it.
function amount(value: number, unit: string | undefined): string {
  const number = value >= COMPACT_FROM ? compact.format(value) : plain.format(value)
  if (!unit || value === 0) return number
  return unit.length <= 2 ? `${number}${unit}` : `${number} ${unit}`
}

// A scale has room for a short unit only; a word would push the numbers out of the plot.
function tickUnit(unit: string | undefined): string | undefined {
  return unit && unit.length <= 2 ? unit : undefined
}

// A bar is square on the baseline and round at its data end.
function roundedTop(bar: { x: number; y: number; width: number; height: number }): string {
  const radius = Math.min(BAR_RADIUS, bar.width / 2, bar.height)
  const right = bar.x + bar.width
  const bottom = bar.y + bar.height
  return `M${bar.x},${bottom} V${bar.y + radius} Q${bar.x},${bar.y} ${bar.x + radius},${bar.y} H${right - radius} Q${right},${bar.y} ${right},${bar.y + radius} V${bottom} Z`
}

// One slice of the ring, between two shares of a full turn that starts at twelve o'clock.
function ring(slice: { centre: number; from: number; to: number }): string {
  // A slice that is the whole ring cannot be drawn as one arc: its ends would meet.
  const to = Math.min(slice.to, slice.from + 0.9999)
  const at = (share: number, radius: number): string => {
    const angle = share * FULL_TURN - Math.PI / 2
    return `${slice.centre + radius * Math.cos(angle)},${slice.centre + radius * Math.sin(angle)}`
  }
  const large = to - slice.from > 0.5 ? 1 : 0
  return `M${at(slice.from, DONUT_OUTER)} A${DONUT_OUTER},${DONUT_OUTER} 0 ${large} 1 ${at(to, DONUT_OUTER)} L${at(to, DONUT_INNER)} A${DONUT_INNER},${DONUT_INNER} 0 ${large} 0 ${at(slice.from, DONUT_INNER)} Z`
}
