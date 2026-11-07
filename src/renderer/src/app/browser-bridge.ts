// Dev-only: makes the renderer work in a plain browser tab by forwarding
// window.api to the Electron main process over the /bridge HTTP+SSE endpoints
// (the browser transport behind the dev-only /bridge endpoints in DevBridge).
import { buildApi, type ApiTransport } from '../../../shared/api'

interface BrowserTransportDeps {
  fetchFn: typeof fetch
  eventSource: () => Pick<EventSource, 'addEventListener'>
}

export function createBrowserTransport(deps: BrowserTransportDeps): ApiTransport {
  let source: Pick<EventSource, 'addEventListener'> | null = null
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>()

  function ensureEventStream(): void {
    if (source) return
    source = deps.eventSource()
    source.addEventListener('message', (event) => {
      const { channel, args } = JSON.parse((event as MessageEvent).data as string) as {
        channel: string
        args: unknown[]
      }
      for (const listener of listeners.get(channel) ?? []) listener(...args)
    })
  }

  return {
    invoke: async (channel, ...args) => {
      // JSON turns trailing undefined args into null, which zod-validated
      // handlers reject; ipcRenderer's structured clone has no such problem
      while (args.length > 0 && args[args.length - 1] === undefined) args.pop()
      const response = await deps.fetchFn('/bridge/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, args })
      })
      const reply = (await response.json()) as { ok: boolean; result?: unknown; error?: string }
      if (!reply.ok) {
        throw new Error(reply.error ?? `Bridge invoke failed for "${channel}"`)
      }
      return reply.result
    },
    on: (channel, listener) => {
      ensureEventStream()
      let set = listeners.get(channel)
      if (!set) {
        set = new Set()
        listeners.set(channel, set)
      }
      set.add(listener)
      return () => set.delete(listener)
    }
  }
}

/**
 * Whether the bridge behind /bridge is this dev run's: one that serves another renderer port (a
 * second dev run holding the bridge port), or none at all, would fail every call.
 */
export async function bridgeConnected(
  fetchFn: typeof fetch,
  rendererPort: string
): Promise<boolean> {
  try {
    const response = await fetchFn('/bridge/hello')
    if (!response.ok) return false
    const { rendererPort: served } = (await response.json()) as { rendererPort?: number }
    return String(served) === rendererPort
  } catch {
    // An unreachable or non-JSON bridge is a bridge this tab cannot use.
    return false
  }
}

/** Install window.api + window.electron when running outside Electron. Call before React renders. */
export function installBrowserBridge(): void {
  if (window.api !== undefined) return
  const transport = createBrowserTransport({
    fetchFn: (input, init) => fetch(input, init),
    eventSource: () => new EventSource('/bridge/events')
  })
  Object.assign(window, {
    api: buildApi(transport),
    electron: { platform: 'darwin' }
  })
  console.info(
    '[Talyx] Browser dev bridge active: window.api forwards to the Electron main process'
  )
  void bridgeConnected(fetch, window.location.port).then((ok) => ok || showBridgeDown())
}

// Dev-only, outside React: the page under it may never load.
function showBridgeDown(): void {
  const banner = document.createElement('div')
  banner.setAttribute('role', 'alert')
  banner.textContent =
    'Dev bridge not connected: this tab cannot reach this dev run. See the [DevBridge] line in the terminal, then start both runs with a free TALYX_BRIDGE_PORT.'
  banner.style.cssText =
    'position:fixed;inset:0 0 auto;z-index:2147483647;padding:8px 16px;background:#b91c1c;color:#fff;font:14px system-ui'
  document.body.append(banner)
}
