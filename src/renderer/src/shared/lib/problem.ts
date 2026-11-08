import type { TranslationKey } from './i18n'

/**
 * A failure the user can act on: `key` is its message in i18n.ts (what failed and what to do),
 * `detail` the underlying text for whoever needs it. Domain errors (RosterError, ProvidersError)
 * extend this.
 */
export class AppError extends Error {
  constructor(
    readonly key: TranslationKey,
    readonly detail: string | null = null
  ) {
    super(key)
    this.name = 'AppError'
  }
}

export interface Problem {
  key: TranslationKey
  detail: string | null
}

// Failures that mean the engine is out of reach, as the socket, fetch and the gateway word them.
const UNREACHABLE =
  /gateway (?:is )?not connected|gateway connection closed|could not connect to engine gateway|socket (?:is not open|failed|closed)|fetch failed|ECONNREFUSED|ECONNRESET/i
// A request the engine did not answer in time: it is running, only slow (or still starting).
const TIMED_OUT = /timed? ?out|TimeoutError|aborted due to timeout/i

/** True for a request the engine did not answer in time, as fetch and the socket word it. */
export function isTimeout(error: unknown): boolean {
  return TIMED_OUT.test(error instanceof Error ? error.message : String(error))
}

/**
 * Any thrown value as a Problem. An unknown error gets a headline by kind: the engine too slow to
 * answer, the engine out of reach, or something unexpected in Talyx itself; its own text stays as the detail.
 */
export function problemOf(error: unknown): Problem {
  if (error instanceof AppError) return { key: error.key, detail: error.detail }
  const detail = error instanceof Error ? error.message : error ? String(error) : null
  return { key: headlineOf(detail), detail }
}

function headlineOf(detail: string | null): TranslationKey {
  if (detail && TIMED_OUT.test(detail)) return 'error.engineTimeout'
  if (detail && UNREACHABLE.test(detail)) return 'error.engineUnreachable'
  return 'error.unexpected'
}

/** A failed action under its own headline (`key`), with the error's text as the detail. */
export function failureOf(key: TranslationKey, error: unknown): Problem {
  return { key, detail: problemOf(error).detail }
}

/** A Problem as one line: the headline, then the detail. For toasts and plain-text notes. */
export function problemText(t: (key: TranslationKey) => string, problem: Problem): string {
  return problem.detail ? `${t(problem.key)} ${problem.detail}` : t(problem.key)
}
