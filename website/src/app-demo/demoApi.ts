/**
 * A `window.api` good enough to render the real renderer in a browser tab.
 *
 * Settings, the engine status and the update state have stubs (the bots, chats and rooms run on
 * the roster fixture's engine double); every other
 * call falls through to the proxy below and answers `undefined`, so a new IPC
 * channel in the app degrades to a quiet no-op here rather than a crash in the
 * landing page.
 */

import { EXPECTED_ENGINE_VERSION } from '../../../src/shared/engine'
import { attachedEngine } from '../../../tests/fixtures/roster/engineDouble'

const noop = (): (() => void) => () => {}

// In memory only: the demo persists nothing.
const SETTINGS: Record<string, unknown> = { theme: 'system' }

const fixtures: Record<string, unknown> = {
  // The double attaches before the first render; a later check finds the same engine.
  getEngineStatus: () => Promise.resolve(attachedEngine(EXPECTED_ENGINE_VERSION)),
  // The footer reads the update state on mount; the demo never has an update.
  getUpdateState: () => Promise.resolve({ kind: 'none' }),
  getSettings: () => Promise.resolve({ ...SETTINGS }),
  setSettings: (partial: Record<string, unknown>) => {
    Object.assign(SETTINGS, partial)
    return Promise.resolve({ ...SETTINGS })
  }
}

/** Unstubbed reads resolve empty; unstubbed `on*` subscriptions unsubscribe cleanly. */
function fallback(name: string): (...args: unknown[]) => unknown {
  if (name.startsWith('on')) return noop
  return () => Promise.resolve(undefined)
}

export function installDemoApi(): void {
  const api = new Proxy({} as Record<string, unknown>, {
    get: (_target, prop: string) => fixtures[prop] ?? fallback(prop)
  })

  Object.defineProperty(window, 'api', { value: api, configurable: true })
  Object.defineProperty(window, 'electron', { value: { platform: 'darwin' }, configurable: true })
}
