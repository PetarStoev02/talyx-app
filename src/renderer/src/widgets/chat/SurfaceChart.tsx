import type { UiComponent } from '@contract/a2uiSurface'
import { niceCeiling } from '@shared/lib/chartPath'
import { cn } from '@shared/lib/utils'

const WIDTH = 640
const HEIGHT = 190
const AXIS = 36
const COLORS = [
  'text-brand',
  'text-success',
  'text-destructive-text',
  'text-muted-foreground'
] as const

type ChartComponent = Extract<UiComponent, { component: 'Chart' }>

export function SurfaceChart({
  chart,
  summary
}: {
  chart: ChartComponent
  summary: string
}): React.JSX.Element {
  const { labels, series, kind, unit } = chart
  const peak = Math.max(...series.flatMap((row) => row.values), 0)
  const top = niceCeiling(peak)
  const gridY = [0, 0.33, 0.66, 1]
  return (
    <div className="w-full">
      {series.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
          {series.map((row, index) => (
            <span key={row.name} className="inline-flex items-center gap-1.5">
              <span
                className={cn(
                  'inline-block size-2 rounded-sm bg-current',
                  COLORS[index % COLORS.length]
                )}
              />
              {row.name}
            </span>
          ))}
        </div>
      )}
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-[190px] w-full text-foreground"
        role="img"
        aria-label={summary}
      >
        {gridY.map((share) => {
          const y = AXIS + (HEIGHT - AXIS - 20) * (1 - share)
          return (
            <g key={share}>
              <line
                x1={AXIS}
                x2={WIDTH - 4}
                y1={y}
                y2={y}
                className="stroke-border"
                strokeWidth={1}
              />
              <text x={0} y={y + 4} className="fill-muted-foreground text-[11px]">
                {formatTick(top * share, unit)}
              </text>
            </g>
          )
        })}
        {kind === 'pie' ? (
          <PieSlice
            values={series[0]?.values ?? []}
            labels={labels}
            cx={(WIDTH + AXIS) / 2}
            cy={(HEIGHT + AXIS) / 2}
            radius={Math.min(WIDTH, HEIGHT) / 2 - AXIS}
          />
        ) : (
          <CartesianSeries
            kind={kind}
            labels={labels}
            series={series}
            top={top}
            unit={unit ?? null}
          />
        )}
        {kind !== 'pie' &&
          labels.map((label, index) => {
            const count = labels.length
            const slot = (WIDTH - AXIS - 8) / count
            const x = AXIS + slot * index + slot / 2
            return (
              <text
                key={label}
                x={x}
                y={HEIGHT - 2}
                textAnchor="middle"
                className="fill-muted-foreground text-[11px]"
              >
                {label}
              </text>
            )
          })}
      </svg>
    </div>
  )
}

function CartesianSeries({
  kind,
  labels,
  series,
  top,
  unit
}: {
  kind: 'bar' | 'line' | 'area'
  labels: string[]
  series: ChartComponent['series']
  top: number
  unit: string | null
}): React.JSX.Element {
  const plotBottom = HEIGHT - 20
  const plotTop = AXIS
  const plotHeight = plotBottom - plotTop
  const slot = (WIDTH - AXIS - 8) / labels.length
  const barWidth = Math.min(44, slot * 0.55)
  return (
    <g>
      {series.map((row, seriesIndex) => (
        <g key={row.name} className={cn(COLORS[seriesIndex % COLORS.length])}>
          {row.values.map((value, index) => {
            const height = (value / top) * plotHeight
            const x =
              AXIS + slot * index + (slot - barWidth) / 2 + seriesIndex * (barWidth / series.length)
            const y = plotBottom - height
            const w = barWidth / series.length
            if (kind === 'bar')
              return (
                <rect
                  key={`${row.name}-${index}`}
                  x={x}
                  y={y}
                  width={w}
                  height={height}
                  rx={6}
                  className="fill-brand"
                />
              )
            return null
          })}
          {kind !== 'bar' &&
            (() => {
              const points = row.values.map((value, index) => {
                const x = AXIS + slot * index + slot / 2
                const y = plotBottom - (value / top) * plotHeight
                return `${x},${y}`
              })
              const line = points.join(' ')
              const [first = ''] = points
              const area =
                kind === 'area'
                  ? `${line} ${points.at(-1)?.split(',')[0] ?? 0},${plotBottom} ${first.split(',')[0]},${plotBottom}`
                  : line
              return (
                <g key={`line-${row.name}`}>
                  {kind === 'area' && (
                    <polyline points={area} className="fill-brand/15 stroke-none" />
                  )}
                  <polyline points={line} fill="none" strokeWidth={2} className="stroke-brand" />
                </g>
              )
            })()}
        </g>
      ))}
      {unit && (
        <text x={AXIS + 4} y={plotTop + 12} className="fill-muted-foreground text-[10px]">
          {unit}
        </text>
      )}
    </g>
  )
}

function pieSlices(
  values: number[],
  cx: number,
  cy: number,
  radius: number
): Array<{ d: string; index: number }> {
  const total = values.reduce((sum, value) => sum + value, 0)
  let angle = -Math.PI / 2
  return values.map((value, index) => {
    const slice = total > 0 ? (value / total) * Math.PI * 2 : 0
    const x1 = cx + radius * Math.cos(angle)
    const y1 = cy + radius * Math.sin(angle)
    angle += slice
    const x2 = cx + radius * Math.cos(angle)
    const y2 = cy + radius * Math.sin(angle)
    const large = slice > Math.PI ? 1 : 0
    void start
    return {
      index,
      d: `M${cx},${cy} L${x1},${y1} A${radius},${radius} 0 ${large} 1 ${x2},${y2} Z`
    }
  })
}

function PieSlice({
  values,
  labels,
  cx,
  cy,
  radius
}: {
  values: number[]
  labels: string[]
  cx: number
  cy: number
  radius: number
}): React.JSX.Element {
  const slices = pieSlices(values, cx, cy, radius)
  return (
    <g>
      {slices.map((slice) => (
        <path
          key={labels[slice.index] ?? slice.index}
          d={slice.d}
          className={cn('fill-brand', slice.index % 2 === 1 && 'fill-brand/60')}
        />
      ))}
    </g>
  )
}

function formatTick(value: number, unit: string | undefined): string {
  const rounded = value >= 1000 ? `${Math.round(value / 1000)}k` : String(Math.round(value))
  return unit ? `${rounded}${unit === 'k' ? '' : ` ${unit}`}` : rounded
}
