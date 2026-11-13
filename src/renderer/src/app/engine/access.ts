import { host } from '@shared/engine/host'
import { engineHttp } from '@shared/engine/http'
import type { EngineHttp } from '@shared/engine/http'

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
}

export const engineAccess: EngineAccess = { request: host.request, http: engineHttp }
