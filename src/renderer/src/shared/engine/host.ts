import type { EngineStatus } from '../../../../shared/engine'
import { engineDialUrl, EngineGateway } from './client'
import { deleteProfile } from './profiles'
import { isStableOpen, reconnectBackoffDelayMs } from './reconnect-backoff'
import type { ConnectionState, GatewayEvent, ServerRequest } from './shared'

export type { EngineStatus }
export type { CanonicalProfileRow, ConnectionState, GatewayEvent, ServerRequest } from './shared'

/**
 * The host calls the bots UI uses, as one plain module (upstream reaches them through a plugin
 * host). One host-scoped socket serves every profile on the gateway: a call names its profile in
 * its params. Calls arrive here as the PR that first uses them lands.
 */
const gateway = new EngineGateway()
let wanted = false
let attempt = 0
let openedAt: number | null = null
let retry: ReturnType<typeof setTimeout> | undefined
let redialed = false
// Sessions this window opened, by owner. The gateway subscribes a session per socket, so a
// redialed socket resumes each one (after the replay of the gap is already in flight).
const openSessions = new Map<string, { profile: string; sessionId: string }>()
const OPENING_METHODS = new Set(['session.create', 'session.resume', 'session.activate'])

gateway.onState((state) => {
  if (state === 'open') {
    openedAt = Date.now()
    if (redialed) resumeOpenSessions()
    redialed = false
  }
  if ((state === 'closed' || state === 'error') && wanted) scheduleReconnect()
})

function resumeOpenSessions(): void {
  for (const { profile, sessionId } of openSessions.values()) {
    gateway
      .request('session.resume', {
        session_id: sessionId,
        profile,
        defer_history: true,
        omit_messages: true
      })
      // A failed re-resume is covered by the chat, which reloads its open sessions on reopen.
      .catch(() => undefined)
  }
}

function scheduleReconnect(): void {
  if (retry !== undefined) return
  redialed = true
  attempt = isStableOpen(openedAt) ? 0 : attempt + 1
  openedAt = null
  retry = setTimeout(() => {
    retry = undefined
    // A failed dial ends in 'error', which schedules the next attempt.
    void gateway.connect(engineDialUrl()).catch(() => undefined)
  }, reconnectBackoffDelayMs(attempt))
}

export const host = {
  status: (): Promise<EngineStatus> => window.api.getEngineStatus() as Promise<EngineStatus>,

  pickEnginePath: (): Promise<EngineStatus> => window.api.pickEnginePath() as Promise<EngineStatus>,

  /** Open the shared socket and keep it open: a drop redials with backoff and replays the gap. */
  connect(): Promise<void> {
    wanted = true
    // The client counts every connect as a new connection, which fails calls still in flight.
    const { connectionState } = gateway
    if (connectionState === 'open' || connectionState === 'connecting') return Promise.resolve()
    return gateway.connect(engineDialUrl())
  },

  disconnect(): void {
    wanted = false
    openSessions.clear()
    clearTimeout(retry)
    retry = undefined
    gateway.close()
  },

  /** Drop the socket as a network failure would, so the reconnect and replay path runs. */
  dropSocket(): void {
    gateway.invalidate('Dropped on purpose')
  },

  async request<T = unknown>(
    profile: string,
    method: string,
    params: Record<string, unknown> = {}
  ): Promise<T> {
    const result = await gateway.request<T>(method, { ...params, profile })
    const sessionId = (result as { session_id?: unknown } | null)?.session_id ?? params.session_id
    if (OPENING_METHODS.has(method) && typeof sessionId === 'string') {
      openSessions.set(JSON.stringify([profile, sessionId]), { profile, sessionId })
    }
    // A session this window let go of is not subscribed again after a redial.
    if (method === 'session.detach')
      openSessions.delete(JSON.stringify([profile, params.session_id]))
    return result
  },

  onEvent: (handler: (event: GatewayEvent) => void): (() => void) => gateway.onEvent(handler),

  /** Clarify and approval cards, live or re-delivered from a snapshot after a reconnect. */
  onPrompt: (handler: (request: ServerRequest) => false | undefined): (() => void) =>
    gateway.onRequest(handler),

  onState: (handler: (state: ConnectionState) => void): (() => void) => gateway.onState(handler),

  /** A REST call, not an RPC: the gateway has no profile delete over the socket. */
  deleteProfile: (profile: string): Promise<{ ok: boolean; path: string }> => deleteProfile(profile)
}
