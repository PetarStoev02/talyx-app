import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  engineWire,
  parseEngineVersion,
  type EngineHttpRequest,
  type EngineStatus,
  type EngineVersion,
  type EngineWire
} from '../../../shared/engine'
import {
  EngineProtocolError,
  isStaleLocalGatewayError,
  mintLocalGatewayTicket,
  nativeGrantProfile,
  nativeGrantPurpose,
  readEnsureResult,
  routedTicketEndpoint,
  runEngineCli,
  type CliResult,
  type EnsureResult,
  type GatewayEndpoint,
  type GatewayTicketPurpose
} from './gateway'

/** The command Talyx runs; the engine's own installer never names it this, so the user links it. */
export const ENGINE_COMMAND = 'talyx-engine'
const DEFAULT_HTTP_TIMEOUT_MS = 30_000
const WINDOWS_UNSUPPORTED = 'Talyx cannot attach to the engine on Windows yet'

export class EngineMissingError extends Error {
  constructor() {
    super(`The engine's command was not found (${ENGINE_COMMAND} on PATH or the chosen file)`)
    this.name = 'EngineMissingError'
  }
}

/** A REST path that resolves outside the gateway's `/api/` routes; its ticket must not leave. */
export class EngineRouteError extends Error {
  constructor() {
    super('Engine request path leaves the gateway API')
    this.name = 'EngineRouteError'
  }
}

export class EngineHttpError extends Error {
  constructor(
    readonly status: number,
    detail: string
  ) {
    super(detail || `Engine request failed with HTTP ${status}`)
    this.name = 'EngineHttpError'
  }
}

export interface Attachment {
  endpoint: GatewayEndpoint
  wire: EngineWire
}

export interface Engine {
  /** `--version` then `gateway ensure --json` for the default profile; never throws. */
  status(): Promise<EngineStatus>
  /** A one-use ticket for `profile`, routed through the attached gateway. */
  mint(profile: string, purpose: GatewayTicketPurpose): Promise<Attachment & { ticket: string }>
  /** One REST call to the gateway with its native ticket header. */
  http(request: EngineHttpRequest): Promise<unknown>
}

export interface EngineDeps {
  enginePath: () => string | null
  run?: (command: string, args: string[]) => Promise<CliResult>
  mintTicket?: typeof mintLocalGatewayTicket
  fetch?: typeof fetch
  platform?: NodeJS.Platform
  home?: string
}

/** Resolution order: the chosen file, then `talyx-engine` on PATH, then the per-OS user bin. A
 *  chosen file that has since moved falls back to the lookups instead of locking Talyx out. */
export function engineCandidates(
  enginePath: string | null,
  platform: NodeJS.Platform,
  home: string
): string[] {
  const userBin = join(
    home,
    '.local',
    'bin',
    platform === 'win32' ? `${ENGINE_COMMAND}.exe` : ENGINE_COMMAND
  )
  return enginePath ? [enginePath, ENGINE_COMMAND, userBin] : [ENGINE_COMMAND, userBin]
}

export function createEngine(deps: EngineDeps): Engine {
  const run = deps.run ?? runEngineCli
  const mintTicket = deps.mintTicket ?? mintLocalGatewayTicket
  const fetchFn = deps.fetch ?? fetch
  const platform = deps.platform ?? process.platform
  const home = deps.home ?? homedir()
  let attached: Promise<{ command: string; version: EngineVersion; ensure: EnsureResult }> | null =
    null
  // The version the last `status()` found, so an attach that fails after `--version` can say it.
  let foundVersion: string | null = null

  async function resolveVersion(): Promise<{ command: string; version: EngineVersion }> {
    for (const command of engineCandidates(deps.enginePath(), platform, home)) {
      let result: CliResult
      try {
        result = await run(command, ['--version'])
      } catch (error) {
        if (isNotFound(error)) continue
        throw error
      }
      const version = parseEngineVersion(result.stdout)
      foundVersion = version.version
      return { command, version }
    }
    throw new EngineMissingError()
  }

  function attach(): Promise<{ command: string; version: EngineVersion; ensure: EnsureResult }> {
    if (attached) return attached
    const pending = (async () => {
      const { command, version } = await resolveVersion()
      const ensure = readEnsureResult(
        await run(command, ['--profile', 'default', 'gateway', 'ensure', '--json'])
      )
      return { command, version, ensure }
    })()
    // A failed attach is never cached: the next call (Retry, a redial) starts over.
    pending.catch(() => {
      if (attached === pending) attached = null
    })
    attached = pending
    return pending
  }

  async function mintOnce(
    profile: string,
    purpose: GatewayTicketPurpose
  ): Promise<Attachment & { ticket: string }> {
    const { version, ensure } = await attach()
    const endpoint = await routedTicketEndpoint(ensure.endpoint, profile)
    return {
      endpoint: ensure.endpoint,
      wire: engineWire(version.name),
      ticket: await mintTicket(endpoint, purpose)
    }
  }

  async function mint(
    profile: string,
    purpose: GatewayTicketPurpose
  ): Promise<Attachment & { ticket: string }> {
    try {
      return await mintOnce(profile, purpose)
    } catch (error) {
      // The cached owner is gone (stopped, restarted): forget it once and re-ensure.
      if (!isStaleLocalGatewayError(error)) throw error
      attached = null
      return mintOnce(profile, purpose)
    }
  }

  return {
    async status(): Promise<EngineStatus> {
      // Windows mints tickets through the engine's own runtime, which Talyx does not drive yet.
      if (platform === 'win32')
        return { state: 'error', message: WINDOWS_UNSUPPORTED, version: null, reason: null }
      attached = null
      foundVersion = null
      try {
        const { version, ensure } = await attach()
        const wire = engineWire(version.name)
        return {
          state: 'attached',
          version: version.version,
          commit: version.commit,
          home: ensure.endpoint.profile_id,
          stale: ensure.stale,
          botMetaKey: wire.botMetaKey,
          botGroupsMetaKey: wire.botGroupsMetaKey,
          managerHandle: wire.managerHandle
        }
      } catch (error) {
        if (error instanceof EngineMissingError)
          return { state: 'missing', enginePath: deps.enginePath() }
        return {
          state: 'error',
          message: error instanceof Error ? error.message : String(error),
          version: foundVersion,
          reason: error instanceof EngineProtocolError ? 'protocol' : null
        }
      }
    },

    mint,

    async http(request: EngineHttpRequest): Promise<unknown> {
      // The grant is chosen from the path alone; the origin comes from the endpoint the mint used,
      // because a stale mint re-ensures and the new gateway may listen on another port.
      const route = new URL(request.path, 'http://gateway.invalid')
      // Dot segments resolve here, so `/api/../x` is caught after resolution, not before.
      if (!route.pathname.startsWith('/api/')) throw new EngineRouteError()
      if (request.profile && !route.searchParams.has('profile'))
        route.searchParams.set('profile', request.profile)
      const method = (request.method ?? 'GET').toUpperCase()
      const grantProfile = nativeGrantProfile(route.toString(), request.body, method) ?? 'default'
      const { endpoint, wire, ticket } = await mint(
        grantProfile,
        nativeGrantPurpose(route.toString(), method)
      )
      // Set the path on the gateway's own URL: joining strings would read `//host` as a new host.
      const url = new URL(endpoint.api_origin)
      url.pathname = route.pathname
      url.search = route.search
      const response = await fetchFn(url, {
        method,
        headers: {
          [wire.ticketHeader]: ticket,
          ...(request.body === undefined ? {} : { 'Content-Type': 'application/json' })
        },
        body: request.body === undefined ? undefined : JSON.stringify(request.body),
        signal: AbortSignal.timeout(request.timeoutMs ?? DEFAULT_HTTP_TIMEOUT_MS)
      })
      const text = await response.text()
      const payload = text ? parseJson(text) : null
      if (!response.ok) throw new EngineHttpError(response.status, errorDetail(payload, text))
      return payload
    }
  }
}

function isNotFound(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException)?.code
  return code === 'ENOENT' || code === 'ENOTDIR'
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function errorDetail(payload: unknown, text: string): string {
  const detail =
    payload && typeof payload === 'object' ? (payload as { detail?: unknown }).detail : undefined
  if (typeof detail === 'string') return detail
  return text.slice(0, 200)
}
