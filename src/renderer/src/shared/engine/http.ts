import type { EngineHttpRequest } from '../../../../shared/engine'

/** The request shape the vendored REST wrappers pass. Talyx is local only: `connectionId` and the
 *  pool hints (`priority`, `passive`) of the old desktop's backend pool are accepted and ignored. */
export interface EngineApiRequest extends EngineHttpRequest {
  connectionId?: string | null
  passive?: boolean
  priority?: 'foreground'
}

/** One REST call to the engine gateway through main, which mints the call's one-use ticket. */
export function engineHttp<T>({
  path,
  method,
  body,
  profile,
  timeoutMs
}: EngineApiRequest): Promise<T> {
  return window.api.engineHttp({ path, method, body, profile, timeoutMs }) as Promise<T>
}
