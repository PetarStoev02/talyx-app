/**
 * Map per-phase pipeline progress onto one 0–100 scale so the bar never
 * jumps backwards when a phase with a different total starts. Each phase
 * owns a fixed slice of the bar.
 */
const PHASE_RANGES: Record<string, [number, number]> = {
  classifying: [0, 5],
  extracting: [5, 40],
  'classifying-ai': [40, 100]
}

export function overallSortProgress(
  phase: string | undefined,
  completed: number,
  total: number
): number {
  if (phase === 'done') return 100
  const range = phase ? PHASE_RANGES[phase] : undefined
  if (!range) return 0
  const [start, end] = range
  if (total <= 0) return start
  const fraction = Math.min(1, Math.max(0, completed / total))
  return start + (end - start) * fraction
}
