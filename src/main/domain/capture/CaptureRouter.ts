import { heuristicRoute, splitTitleBody, tomorrowAtTen } from './noteHeuristic'
import type { CaptureDestination, CaptureRoute, RouteCaptureInput } from './CaptureTypes'

const DESTINATIONS: CaptureDestination[] = ['note', 'reminder', 'calendar', 'file']

const TOOL_BY_DEST: Record<CaptureDestination, CaptureRoute['tool']> = {
  note: 'take_note',
  reminder: 'remind_me',
  calendar: 'create_event',
  file: 'save_to_inbox'
}

/**
 * Turn a dump into a capability call. Claude picks destination (unless a chip
 * overrides); any failure falls back to heuristics for chip ?? note.
 */
export async function routeCapture(input: RouteCaptureInput): Promise<CaptureRoute> {
  const text = input.text.trim()
  if (text.length === 0) throw new Error('Nothing to capture')

  const fallbackDest: CaptureDestination = input.chip ?? 'note'
  if (!input.claude) return heuristicRoute(text, fallbackDest, input.now)

  try {
    const reply = await input.claude.complete(
      [{ role: 'user', text: buildPrompt(text, input.chip, input.now) }],
      input.signal
    )
    const parsed = parseRoute(reply.text, text, input.now, input.chip)
    if (parsed) return parsed
  } catch {
    // Timeout, abort, or provider error — heuristics below.
  }
  return heuristicRoute(text, fallbackDest, input.now)
}

function buildPrompt(text: string, chip: CaptureDestination | null, now: Date): string {
  const locked = chip
    ? `Destination is fixed to "${chip}". Fill only the params for that destination.`
    : `Pick exactly one destination: note, reminder, calendar, or file.`
  return `You route a quick capture dump into one destination.
${locked}

Reply with JSON only, no markdown fence:
{"destination":"note|reminder|calendar|file","title":"...","body":"...","due":null|"ISO-8601-with-offset","start":null|"ISO-8601-with-offset","durationMinutes":60}

Rules:
- note / file: title short; body is the dump (may repeat title).
- reminder: title what to do; due ISO with offset or null.
- calendar: title; start ISO with offset; durationMinutes 1–1440 (default 60).
- Local now is ${now.toISOString()} (use the user's local offset in due/start).
- Dump:
---
${text.slice(0, 4000)}
---`
}

function parseRoute(
  raw: string,
  text: string,
  now: Date,
  chip: CaptureDestination | null
): CaptureRoute | null {
  const json = extractJson(raw)
  if (!json || typeof json !== 'object') return null
  const obj = json as Record<string, unknown>

  let destination = asDestination(obj.destination)
  if (chip) destination = chip
  if (!destination) return null

  const { title: fallbackTitle, body: fallbackBody } = splitTitleBody(text)
  const title =
    typeof obj.title === 'string' && obj.title.trim().length > 0
      ? obj.title.trim().slice(0, 80)
      : fallbackTitle
  const body = typeof obj.body === 'string' ? obj.body : fallbackBody || text.trim()

  switch (destination) {
    case 'note':
      return { destination, tool: TOOL_BY_DEST.note, input: { title, body } }
    case 'file':
      return { destination, tool: TOOL_BY_DEST.file, input: { title, body } }
    case 'reminder': {
      const due =
        obj.due === null || obj.due === undefined
          ? null
          : typeof obj.due === 'string'
            ? obj.due
            : null
      return {
        destination,
        tool: TOOL_BY_DEST.reminder,
        input: { title: title || text.trim(), due }
      }
    }
    case 'calendar': {
      const start =
        typeof obj.start === 'string' && obj.start.length > 0 ? obj.start : tomorrowAtTen(now)
      const durationMinutes =
        typeof obj.durationMinutes === 'number' &&
        Number.isFinite(obj.durationMinutes) &&
        obj.durationMinutes >= 1
          ? Math.min(1440, Math.floor(obj.durationMinutes))
          : 60
      return {
        destination,
        tool: TOOL_BY_DEST.calendar,
        input: {
          title: title || text.trim(),
          start,
          durationMinutes,
          location: typeof obj.location === 'string' ? obj.location : null,
          calendar: typeof obj.calendar === 'string' ? obj.calendar : null
        }
      }
    }
  }
}

function asDestination(value: unknown): CaptureDestination | null {
  return typeof value === 'string' && (DESTINATIONS as string[]).includes(value)
    ? (value as CaptureDestination)
    : null
}

function extractJson(raw: string): unknown {
  const trimmed = raw.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start === -1 || end <= start) return null
    try {
      return JSON.parse(trimmed.slice(start, end + 1))
    } catch {
      return null
    }
  }
}
