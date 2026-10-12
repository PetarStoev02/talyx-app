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
      // handlers reject — ipcRenderer's structured clone has no such problem
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
    },
    getPathForFile: () => {
      throw new Error(
        'OS file paths are not available in browser dev mode — use the folder picker instead'
      )
    }
  }
}

/** Install window.api + window.electron when running outside Electron. Call before React renders. */
export function installBrowserBridge(): void {
  if (window.api !== undefined) return
  const transport = createBrowserTransport({
    fetchFn: (input, init) => fetch(input, init),
    eventSource: () => new EventSource('/bridge/events')
  })
  const electronStub = {
    platform: 'darwin',
    systemVersion: 'unknown'
  }
  Object.assign(window, {
    api: buildApi(transport),
    electron: electronStub
  })
  console.info(
    '[Talyx] Browser dev bridge active — window.api forwards to the Electron main process'
  )
}
