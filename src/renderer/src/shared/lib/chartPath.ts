// Geometry for the app's small charts, drawn as plain SVG paths.

export interface Point {
  x: number
  y: number
}

/**
 * A smooth line through every point that never overshoots between two of them (monotone cubic,
 * Fritsch-Carlson), so a curve over counts never dips below zero or above its peak.
 */
export function smoothPath(points: Point[]): string {
  const [first] = points
  if (!first) return ''
  const at = (point: Point): string => `${round(point.x)},${round(point.y)}`
  let path = `M${at(first)}`
  for (const [a, b] of pairs(monotoneTangents(points))) {
    const third = (b.x - a.x) / 3
    path += ` C${at({ x: a.x + third, y: a.y + a.tangent * third })} ${at({ x: b.x - third, y: b.y - b.tangent * third })} ${at(b)}`
  }
  return path
}

// Round tops for an axis, as multiples of a power of ten: fine enough that the peak fills most of it.
const NICE_STEPS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]

// Below this the half-way gridline would fall between whole counts.
const LEAST_TOP = 10

/** The smallest round number at or above `peak`, from NICE_STEPS times a power of ten. */
export function niceCeiling(peak: number): number {
  if (peak <= LEAST_TOP) return LEAST_TOP
  const power = 10 ** Math.floor(Math.log10(peak))
  const step = NICE_STEPS.find((factor) => factor * power >= peak) ?? 10
  return step * power
}

function monotoneTangents(points: Point[]): Array<Point & { tangent: number }> {
  const slopes = pairs(points).map(([a, b]) => (b.y - a.y) / (b.x - a.x))
  return points.map((point, i) => {
    const [before, after] = [slopes[i - 1], slopes[i]]
    // An end has one side: the curve leaves it along that slope.
    if (before === undefined || after === undefined)
      return { ...point, tangent: before ?? after ?? 0 }
    // A peak, a trough or a flat side: the curve is level there, so it cannot overshoot.
    if (before * after <= 0) return { ...point, tangent: 0 }
    return { ...point, tangent: (2 * before * after) / (before + after) }
  })
}

// Each item with the one after it.
function pairs<T>(items: T[]): Array<[T, T]> {
  return items.flatMap((item, i): Array<[T, T]> => {
    const next = items[i + 1]
    return next === undefined ? [] : [[item, next]]
  })
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}
