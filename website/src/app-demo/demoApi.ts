/**
 * A `window.api` good enough to render the real renderer in a browser tab.
 *
 * Only settings have a fixture; every other call falls through to the proxy
 * below and answers `undefined`, so a new IPC channel in the app degrades to a
 * quiet no-op here rather than a crash in the landing page.
 */

import { EXPECTED_ENGINE_VERSION } from '../../../src/shared/engine'

const noop = (): (() => void) => () => {}

const SETTINGS = { theme: 'system', sidebarCollapsed: false }

// The landing page has no engine; it shows the attached shell on the expected version (so no
// update notice). The keys are placeholders.
const ENGINE_STATUS = {
  state: 'attached',
  version: EXPECTED_ENGINE_VERSION,
  commit: null,
  home: '/demo',
  stale: false,
  botMetaKey: 'demo-bots',
  botGroupsMetaKey: 'demo-bots-groups'
}

const fixtures: Record<string, unknown> = {
  getEngineStatus: () => Promise.resolve({ ...ENGINE_STATUS }),
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
