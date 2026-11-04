/**
 * A WebSocket-shaped handle over main's gateway socket (engine:socket-*). The vendored client
 * takes it through its `socketFactory` hook, so its connect, replay and close logic run unchanged.
 */
const sockets = new Map<string, EngineIpcSocket>()
// One frame and one close subscription for every socket, made on first use.
let subscribedTo: typeof window.api | null = null

function listen(): void {
  if (subscribedTo === window.api) return
  subscribedTo = window.api
  window.api.onEngineSocketFrame((id, text) => sockets.get(id)?.receive(text))
  window.api.onEngineSocketClosed((id, code, reason) => sockets.get(id)?.closed(code, reason))
}

export class EngineIpcSocket extends EventTarget {
  readonly id = crypto.randomUUID()
  readyState: number = WebSocket.CONNECTING
  // Main answers the open call and relays frames on separate channels (separate HTTP and SSE
  // streams through the dev bridge), so a frame can beat the open reply. Hold it until open.
  private early: string[] = []

  constructor(readonly profile: string) {
    super()
    listen()
    sockets.set(this.id, this)
    window.api.openEngineSocket(this.id, profile).then(
      () => {
        // Closed while main was still opening it: main never saw that close, so send it now.
        if (this.readyState !== WebSocket.CONNECTING) {
          void window.api.closeEngineSocket(this.id)
          return
        }
        this.readyState = WebSocket.OPEN
        this.dispatchEvent(new Event('open'))
        for (const text of this.early.splice(0)) this.receive(text)
      },
      (error: unknown) => {
        if (this.readyState === WebSocket.CLOSED) return
        this.dispatchEvent(Object.assign(new Event('error'), { message: String(error) }))
        this.closed(1006, error instanceof Error ? error.message : String(error))
      }
    )
  }

  send(text: string): void {
    // A send after main closed the socket fails; main's close event already reports the drop.
    window.api.sendEngineSocket(this.id, text).catch(() => undefined)
  }

  close(): void {
    if (this.readyState === WebSocket.CLOSED) return
    void window.api.closeEngineSocket(this.id)
    // The vendored client drops its socket generation before it closes it, so no one waits
    // for main's close event; settle locally.
    this.closed(1000, '')
  }

  receive(text: string): void {
    if (this.readyState === WebSocket.CONNECTING) this.early.push(text)
    else if (this.readyState === WebSocket.OPEN)
      this.dispatchEvent(new MessageEvent('message', { data: text }))
  }

  closed(code: number, reason: string): void {
    if (this.readyState === WebSocket.CLOSED) return
    this.readyState = WebSocket.CLOSED
    sockets.delete(this.id)
    this.dispatchEvent(new CloseEvent('close', { code, reason }))
  }
}
