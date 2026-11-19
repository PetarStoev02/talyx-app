// The renderer's plain timers, for a wait outside a component (a retry, a deadline). The kernel
// lists this file (eslint.kernel.mjs); inside a component, a named hook under shared/hooks owns
// the timer, so it ends with the part.

/** Resolves after `ms`. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Calls `run` after `ms`; the returned function cancels it if it has not run yet. */
export function after(ms: number, run: () => void): () => void {
  const timer = setTimeout(run, ms)
  return () => clearTimeout(timer)
}
