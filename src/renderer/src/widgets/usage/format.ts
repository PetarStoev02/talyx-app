import type { TranslationKey } from '@shared/lib/i18n'

export type Translate = (key: TranslationKey) => string

const COMPACT = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
const SHORT_DATE = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' })

export function compact(count: number): string {
  return COMPACT.format(count)
}

export function requestsText(t: Translate, count: number): string {
  return t(count === 1 ? 'usage.request' : 'usage.requests').replace('{count}', compact(count))
}

/** `part` as a share of `whole`, to 0.1%; a share too small to round still shows it is there. */
export function shareText(part: number, whole: number): string {
  const percent = whole ? Math.round((part / whole) * 1000) / 10 : 0
  return percent === 0 && part > 0 ? '<0.1' : String(percent)
}

/** A YYYY-MM-DD local day as "Nov 16". */
export function dayLabel(day: string): string {
  const [year, month, date] = day.split('-').map(Number)
  if (year === undefined || month === undefined || date === undefined) return day
  return SHORT_DATE.format(new Date(year, month - 1, date))
}
