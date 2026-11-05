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
  /gateway (?:is )?not connected|socket (?:is not open|failed|closed)|fetch failed|ECONNREFUSED|ECONNRESET|timed? ?out|TimeoutError/i

/**
 * Any thrown value as a Problem. An unknown error gets a headline by kind: the engine out of
 * reach, or something unexpected in Talyx itself; its own text stays as the detail.
 */
export function problemOf(error: unknown): Problem {
  if (error instanceof AppError) return { key: error.key, detail: error.detail }
  const detail = error instanceof Error ? error.message : error ? String(error) : null
  return {
    key: detail && UNREACHABLE.test(detail) ? 'error.engineUnreachable' : 'error.unexpected',
    detail
  }
}

/** A failed action under its own headline (`key`), with the error's text as the detail. */
export function failureOf(key: TranslationKey, error: unknown): Problem {
  return { key, detail: problemOf(error).detail }
}

/** A Problem as one line: the headline, then the detail. For toasts and plain-text notes. */
export function problemText(t: (key: TranslationKey) => string, problem: Problem): string {
  return problem.detail ? `${t(problem.key)} ${problem.detail}` : t(problem.key)
}
