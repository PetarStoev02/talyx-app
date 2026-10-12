import type { CaptureDestination, CaptureRoute } from './CaptureTypes'

const MAX_TITLE = 80
const DEFAULT_EVENT_MINUTES = 60
const TOMORROW_HOUR = 10

/** Split dump text into a short title and optional body. */
export function splitTitleBody(text: string): { title: string; body: string } {
  const trimmed = text.trim()
  const nl = trimmed.indexOf('\n')
  if (nl === -1) {
    return { title: clip(trimmed, MAX_TITLE), body: '' }
  }
  const first = trimmed.slice(0, nl).trim()
  const rest = trimmed.slice(nl + 1).trim()
  return {
    title: clip(first.length > 0 ? first : rest, MAX_TITLE),
    body: first.length > 0 ? rest : ''
  }
}

function clip(value: string, max: number): string {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1)}…`
}

/** Local tomorrow at TOMORROW_HOUR:00 as ISO 8601 with offset. */
export function tomorrowAtTen(now: Date): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, TOMORROW_HOUR, 0, 0, 0)
  return toOffsetIso(d)
}

function toOffsetIso(d: Date): string {
  const pad = (n: number): string => n.toString().padStart(2, '0')
  const offsetMin = -d.getTimezoneOffset()
  const sign = offsetMin >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMin)
  const oh = pad(Math.floor(abs / 60))
  const om = pad(abs % 60)
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${oh}:${om}`
  )
}

/**
 * Build a route without Claude. Used when there is no brain, the route timed
 * out, or the model reply could not be parsed.
 */
export function heuristicRoute(
  text: string,
  destination: CaptureDestination,
  now: Date
): CaptureRoute {
  const { title, body } = splitTitleBody(text)
  const full = text.trim()
  switch (destination) {
    case 'note':
      return { destination: 'note', tool: 'take_note', input: { title, body } }
    case 'reminder':
      return {
        destination: 'reminder',
        tool: 'remind_me',
        input: { title: full || title, due: null }
      }
    case 'calendar':
      return {
        destination: 'calendar',
        tool: 'create_event',
        input: {
          title: full || title,
          start: tomorrowAtTen(now),
          durationMinutes: DEFAULT_EVENT_MINUTES,
          location: null,
          calendar: null
        }
      }
    case 'file':
      return {
        destination: 'file',
        tool: 'save_to_inbox',
        input: { title, body: body.length > 0 ? body : full }
      }
  }
}
