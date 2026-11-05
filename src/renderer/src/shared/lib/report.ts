// Longer reports are cut: a log line, not a dump.
const MAX_REPORT = 8000

/**
 * Records a failure the user may not see: in the console, and in Talyx's log file through main.
 * `scope` names where it happened ("chat", "window"). Never throws, so it is safe in handlers.
 */
export function reportError(scope: string, error: unknown): void {
  console.error(`[${scope}]`, error)
  const message =
    error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error)
  // A failed log write must not report itself again.
  window.api?.logError({ scope, message: message.slice(0, MAX_REPORT) }).catch(() => undefined)
}
