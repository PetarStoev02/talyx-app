import {
  createServer,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type Server,
  type ServerResponse
} from 'http'
import log from 'electron-log'

type IpcHandler = (event: unknown, ...args: unknown[]) => unknown
type BroadcastListener = (channel: string, ...args: unknown[]) => void

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]'])

export interface BridgePorts {
  bridgePort: number
  rendererPort: number
}

/**
 * The bridge reaches every IPC handler, so only the dev renderer may call it:
 * a loopback Host (defeats DNS rebinding), the renderer's Origin whenever a
 * browser sends one (defeats a cross-site POST), and a JSON body (a
 * cross-origin JSON POST needs a CORS preflight the bridge never answers).
 */
export function isTrustedBridgeRequest(
  request: { method: string; headers: IncomingHttpHeaders },
  ports: BridgePorts
): boolean {
  const { headers } = request
  if (!isLoopback(`http://${headers.host ?? ''}`, ports.bridgePort)) return false
  if (headers.origin !== undefined && !isLoopback(headers.origin, ports.rendererPort)) return false
  if (request.method === 'POST') {
    return (headers['content-type'] ?? '').startsWith('application/json')
  }
  return true
}

function isLoopback(url: string, port: number): boolean {
  try {
    const parsed = new URL(url)
    return LOOPBACK_HOSTNAMES.has(parsed.hostname) && Number(parsed.port) === port
  } catch {
    return false
  }
}

/** The one log line for a bridge that did not start; a taken port names the way out. */
export function bridgeStartFailure(error: unknown, port: number): string {
  if ((error as NodeJS.ErrnoException | null)?.code === 'EADDRINUSE')
    return `[DevBridge] Port ${port} is taken, probably by another dev run: the browser renderer cannot reach this app. Start both runs with a free TALYX_BRIDGE_PORT.`
  return `[DevBridge] Could not start on port ${port}: ${error instanceof Error ? error.message : String(error)}`
}

/**
 * Dev-only bridge that lets a plain browser tab drive the app: window.api
 * calls arrive as POST /bridge/invoke and are dispatched to the same handlers
 * registered via ipcMain.handle; progress/broadcast events stream back over
 * SSE (GET /bridge/events). Never constructed in production.
 */
export class DevBridge {
  private handlers = new Map<string, IpcHandler>()
  private broadcastListeners: BroadcastListener[] = []
  private sseClients = new Set<ServerResponse>()
  private server: Server | null = null
  private bridgePort = 0
  /** One stand-in for every browser tab, so the sockets a tab opens stay its own to use. */
  private readonly sender = {
    send: (channel: string, ...args: unknown[]): void => this.broadcast(channel, ...args),
    isDestroyed: (): boolean => false
  }

  constructor(private readonly rendererPort: number) {}

  /** Wrap ipcMain.handle so every registration is also recorded here. Install BEFORE the register*Ipc calls. */
  installTap(ipc: { handle: (channel: string, fn: IpcHandler) => void }): void {
    const original = ipc.handle.bind(ipc)
    ipc.handle = (channel: string, fn: IpcHandler): void => {
      this.handlers.set(channel, fn)
      original(channel, fn)
    }
  }

  onBroadcast(listener: BroadcastListener): void {
    this.broadcastListeners.push(listener)
  }

  /** Send an event to every connected browser tab (and any test listeners). */
  broadcast(channel: string, ...args: unknown[]): void {
    for (const listener of this.broadcastListeners) listener(channel, ...args)
    const payload = `data: ${JSON.stringify({ channel, args })}\n\n`
    for (const client of this.sseClients) client.write(payload)
  }

  async dispatchInvoke(
    channel: string,
    args: unknown[]
  ): Promise<{ ok: boolean; result?: unknown; error?: string }> {
    const handler = this.handlers.get(channel)
    if (!handler) return { ok: false, error: `No ipcMain handler registered for "${channel}"` }
    try {
      const result = await handler({ sender: this.sender }, ...args)
      return { ok: true, result }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  start(port: number): Promise<void> {
    this.bridgePort = port
    this.server = createServer((req, res) => this.route(req, res))
    return new Promise((resolve, reject) => {
      // A taken port (another dev run) rejects instead of crashing main.
      this.server!.once('error', reject)
      this.server!.listen(port, '127.0.0.1', () => {
        log.info(`[DevBridge] Browser dev bridge on http://127.0.0.1:${port}`)
        resolve()
      })
    })
  }

  stop(): Promise<void> {
    for (const client of this.sseClients) client.end()
    this.sseClients.clear()
    return new Promise((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()))
  }

  private route(req: IncomingMessage, res: ServerResponse): void {
    const trusted = isTrustedBridgeRequest(
      { method: req.method ?? '', headers: req.headers },
      { bridgePort: this.bridgePort, rendererPort: this.rendererPort }
    )
    if (!trusted) {
      res.writeHead(403)
      res.end()
      return
    }
    if (req.method === 'POST' && req.url === '/bridge/invoke') {
      let body = ''
      req.on('data', (chunk) => (body += chunk))
      req.on('end', () => {
        void (async (): Promise<void> => {
          try {
            const { channel, args } = JSON.parse(body) as { channel: string; args: unknown[] }
            const reply = await this.dispatchInvoke(channel, args ?? [])
            res.writeHead(reply.ok ? 200 : 400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(reply))
          } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: false, error: String(err) }))
          }
        })()
      })
      return
    }
    // Lets a browser tab check it reached this app's bridge, not another dev run's.
    if (req.method === 'GET' && req.url === '/bridge/hello') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ rendererPort: this.rendererPort }))
      return
    }
    if (req.method === 'GET' && req.url === '/bridge/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      })
      res.write(': connected\n\n')
      this.sseClients.add(res)
      req.on('close', () => this.sseClients.delete(res))
      return
    }
    res.writeHead(404)
    res.end()
  }
}
