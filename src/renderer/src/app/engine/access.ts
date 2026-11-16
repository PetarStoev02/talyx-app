import { host } from '@shared/engine/host'
import { engineHttp } from '@shared/engine/http'
import type { EngineHttp } from '@shared/engine/http'
import type { GatewayEvent } from '@shared/engine/host'

/**
 * The engine's two doors: a socket request by method name and a REST call by path. Only the
 * wiring in this folder uses them; each feature's backend speaks Talyx's own terms over them.
 */
export interface EngineAccess {
  request: <T = unknown>(
    profile: string,
    method: string,
    params?: Record<string, unknown>
  ) => Promise<T>
  http: EngineHttp
  /** Every event the engine sends; returns the call that stops listening. */
  onEvent: (handler: (event: GatewayEvent) => void) => () => void
}

export const engineAccess: EngineAccess = {
  request: host.request,
  http: engineHttp,
  onEvent: host.onEvent
}
