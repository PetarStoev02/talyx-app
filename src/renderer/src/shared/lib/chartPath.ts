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
  if (points.length === 0) return ''
  const at = (point: Point): string => `${round(point.x)},${round(point.y)}`
  if (points.length === 1) return `M${at(points[0])}`
  const tangents = monotoneTangents(points)
  let path = `M${at(points[0])}`
  for (let i = 0; i < points.length - 1; i++) {
    const [a, b] = [points[i], points[i + 1]]
    const third = (b.x - a.x) / 3
    path += ` C${at({ x: a.x + third, y: a.y + tangents[i] * third })} ${at({ x: b.x - third, y: b.y - tangents[i + 1] * third })} ${at(b)}`
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

function monotoneTangents(points: Point[]): number[] {
  const slopes = points
    .slice(1)
    .map((point, i) => (point.y - points[i].y) / (point.x - points[i].x))
  return points.map((_, i) => {
    if (i === 0) return slopes[0]
    if (i === points.length - 1) return slopes[i - 1]
    const [before, after] = [slopes[i - 1], slopes[i]]
    // A peak, a trough or a flat side: the curve is level there, so it cannot overshoot.
    if (before * after <= 0) return 0
    return (2 * before * after) / (before + after)
  })
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}
