// Ported from the engine desktop app's electron/local-gateway.ts (tag v0.22.5): attach to the
// per-host gateway with `gateway ensure --json` and mint one-use tickets through the profile's
// control socket. Logic is kept as upstream wrote it, with these cuts (see README, Engine):
// - no stale-owner restart: Talyx never owns, restarts or kills the gateway, it attaches as-is;
// - no renderer dial bookkeeping: main opens the socket itself (engineSockets.ts);
// - only the direct `<home>/gateway.sock` control socket; the long-path fallback directory and
//   Windows minting (the engine's Python bridge) are not supported yet.
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'

// `gateway ensure` answers with a protocol verdict within its own 60 s startup deadline. The
// client is killed only after that deadline plus interpreter start and verdict output, so a
// slow-but-valid cold start is never reported as "produced no result".
const GATEWAY_ENSURE_TIMEOUT_MS = 75_000
const MAX_ENSURE_OUTPUT = 65_536
const TICKET_DEADLINE_MS = 5_000
const PROFILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

export interface GatewayEndpoint {
  profile_id: string
  instance_id: string
  authority_epoch: number
  runtime_protocol: number
  api_origin: string
  capabilities: string[]
  supervisor: string
  /** Multiplexer home whose control socket answers for a served secondary; null when the profile owns its own. */
  control_home?: string | null
  code_sha?: string | null
}

export interface EnsureResult {
  endpoint: GatewayEndpoint
  /** The ready owner runs other code than this CLI (it outlived an engine update). */
  stale: boolean
}

/** Every purpose Talyx mints a gateway ticket for. */
export type GatewayTicketPurpose =
  | 'interactive'
  | 'native-http'
  | 'native-profile-create'
  | 'native-profile-registry'

export interface CliResult {
  code: number
  stdout: string
  stderr: string
}

/** Run one bounded engine CLI client. Only that client is ours; never its detached gateway. */
export function runEngineCli(command: string, args: string[]): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    let stdout = ''
    let stderr = ''
    let expired: string | undefined
    const expire = (message: string): void => {
      if (expired) return
      expired = message
      child.kill()
    }
    const timer = setTimeout(() => expire('timed out'), GATEWAY_ENSURE_TIMEOUT_MS)
    child.stdout.on('data', (data) => {
      stdout += data.toString()
      if (stdout.length > MAX_ENSURE_OUTPUT) expire('output exceeded limit')
    })
    // Diagnostics only (never protocol): a missing profile or an import crash explain
    // themselves here while stdout stays empty.
    child.stderr.on('data', (data) => (stderr = (stderr + data.toString()).slice(-4096)))
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({
        code: expired ? code || 7 : (code ?? 7),
        stdout,
        stderr: expired ? `${stderr}\n${expired}`.trim() : stderr
      })
    })
  })
}

/** The single-line JSON `gateway ensure --json` prints, or a diagnosis of why there is none. */
export function parseGatewayEnsureOutput(result: CliResult): Record<string, unknown> {
  try {
    const payload: unknown = JSON.parse(result.stdout)
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      return payload as Record<string, unknown>
    }
  } catch {
    // diagnosed below
  }
  const reason = result.stderr.trim().split(/\r?\n/).filter(Boolean).pop()
  throw new Error(
    `talyx-engine gateway ensure produced no result (exit ${result.code})${reason ? `: ${reason}` : ''}. Update the engine or check the profile, then retry.`
  )
}

/** Accept a ready (or restart-wait) answer and return its loopback endpoint, else throw. */
export function readEnsureResult(result: CliResult): EnsureResult {
  const payload = parseGatewayEnsureOutput(result)
  const restartWait =
    payload.state === 'draining' &&
    payload.reason_code === 'restart_wait' &&
    Boolean(payload.endpoint)
  if (!restartWait && (result.code !== 0 || payload.state !== 'ready')) {
    const detail =
      typeof payload.detail === 'string' && payload.detail.trim()
        ? ` ${payload.detail.trim().split(/\r?\n/)[0]}.`
        : ''
    const recovery = payload.reason_code === 'update_paused' ? 'restart' : 'status'
    throw new Error(
      `Gateway ${String(payload.state || 'inaccessible')} (${String(payload.reason_code || 'ensure_failed')}).${detail} Use talyx-engine gateway ${recovery} for recovery.`
    )
  }
  const endpoint = payload.endpoint as GatewayEndpoint
  assertLocalGatewayEndpoint(endpoint)
  const gatewaySha = endpoint.code_sha
  const clientSha = payload.client_code_sha
  return {
    endpoint,
    stale:
      typeof gatewaySha === 'string' &&
      typeof clientSha === 'string' &&
      !!gatewaySha &&
      !!clientSha &&
      gatewaySha.toLowerCase() !== clientSha.toLowerCase()
  }
}

/** The gateway speaks another runtime protocol than this client; says nothing about the endpoint. */
// Talyx: split out of the invalid-endpoint error so the app can name a protocol mismatch.
export class EngineProtocolError extends Error {
  constructor() {
    super('The engine speaks another gateway protocol than this version of Talyx')
    this.name = 'EngineProtocolError'
  }
}

/** Loopback-only, bare-origin, session-authority endpoint or throw. */
export function assertLocalGatewayEndpoint(endpoint: GatewayEndpoint | undefined): void {
  const origin = endpoint ? safeUrl(endpoint.api_origin) : null
  if (
    !endpoint ||
    !origin ||
    !['http:', 'https:'].includes(origin.protocol) ||
    !['127.0.0.1', '[::1]'].includes(origin.hostname) ||
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash ||
    !origin.port ||
    !endpoint.instance_id ||
    !endpoint.profile_id
  ) {
    throw new Error('Invalid local gateway endpoint')
  }
  // Talyx: checked after the origin, so a foreign origin is never reported as a protocol problem.
  if (
    endpoint.runtime_protocol !== 1 ||
    !Array.isArray(endpoint.capabilities) ||
    !endpoint.capabilities.includes('session-authority-v1')
  ) {
    throw new EngineProtocolError()
  }
}

function safeUrl(value: unknown): URL | null {
  try {
    return typeof value === 'string' ? new URL(value) : null
  } catch {
    return null
  }
}

// A cached endpoint pins the gateway instance that answered the first ensure. When that owner is
// gone (crash, `gateway stop`, update restart) every mint against its control socket fails; the
// caller forgets the endpoint once and re-ensures. A second failure is a real error.
const STALE_CONTROL_ERRORS = new Set([
  'Invalid gateway ticket response',
  'Noncanonical gateway profile'
])

export function isStaleLocalGatewayError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return message.startsWith('Gateway ticket') || STALE_CONTROL_ERRORS.has(message)
}

/** The launch profile's own name: `<root>/profiles/<name>` is `name`, the root is `default`. */
export function endpointProfileName(endpoint: GatewayEndpoint): string {
  return path.basename(path.dirname(endpoint.profile_id)) === 'profiles'
    ? path.basename(endpoint.profile_id)
    : 'default'
}

/** The endpoint a profile-scoped dial or request mints for: the same gateway, the ticket bound to
 *  the sibling profile's home (`profiles/<name>` under the root). The gateway refuses a ticket for
 *  a profile it does not serve, so a bad name fails closed. */
export function routedGatewayEndpoint(
  endpoint: GatewayEndpoint,
  profile: string | null | undefined
): GatewayEndpoint {
  const name = profile?.trim()
  if (!name || name === 'current' || name === endpointProfileName(endpoint)) return endpoint
  if (!PROFILE_NAME.test(name)) throw new Error('Invalid profile route')
  // The root home is the endpoint's own resolved profile_id, never a raw (maybe symlinked) path.
  const root =
    endpointProfileName(endpoint) === 'default'
      ? endpoint.profile_id
      : path.dirname(path.dirname(endpoint.profile_id))
  const home = name === 'default' ? root : path.join(root, 'profiles', name)
  return {
    ...endpoint,
    profile_id: home,
    control_home: endpoint.control_home || endpoint.profile_id
  }
}

/** `routedGatewayEndpoint` bound to the home the gateway reserved for the routed profile. */
export async function routedTicketEndpoint(
  endpoint: GatewayEndpoint,
  profile: string | null | undefined
): Promise<GatewayEndpoint> {
  const routed = routedGatewayEndpoint(endpoint, profile)
  if (routed.profile_id === endpoint.profile_id || routed.profile_id === routed.control_home)
    return routed
  const home = await reservedHome(routed.profile_id).catch((error: unknown) => {
    // Not stale: re-ensuring cannot bring a deleted profile back.
    if (isMissingNodeError(error)) {
      throw new Error(
        `Profile '${path.basename(routed.profile_id)}' does not exist: no directory at ${routed.profile_id}`
      )
    }
    throw error
  })
  return { ...routed, profile_id: home }
}

/** `/api/profiles/<suffix>` collection routes, by method. Any other method on these paths is the
 *  per-profile route of a profile NAMED `active`, `import`, `sessions`, … */
const PROFILE_COLLECTION_ROUTES: Readonly<Record<string, readonly string[]>> = {
  active: ['GET', 'POST'],
  import: ['POST'],
  'projects/tree': ['GET'],
  sessions: ['GET'],
  'sessions/pull-requests': ['POST'],
  'sessions/sidebar': ['GET']
}

function profileRouteSuffix(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed.startsWith('/api/profiles/') ? trimmed.slice('/api/profiles/'.length) : ''
}

function profileCollectionRoute(pathname: string, method?: string): string | null {
  const suffix = profileRouteSuffix(pathname)
  if (!suffix || !Object.hasOwn(PROFILE_COLLECTION_ROUTES, suffix)) return null
  return method === undefined || PROFILE_COLLECTION_ROUTES[suffix].includes(method.toUpperCase())
    ? suffix
    : null
}

/** The native grant a REST request needs. Creating a profile and renaming/deleting the one a path
 *  names are registry operations with grants of their own; every other route is `native-http`. */
export function nativeGrantPurpose(url: string, method = 'GET'): GatewayTicketPurpose {
  const verb = method.toUpperCase()
  const pathname = new URL(url).pathname.replace(/\/+$/, '')
  if (verb === 'POST' && pathname === '/api/profiles') return 'native-profile-create'
  const suffix = profileRouteSuffix(pathname)
  if (
    (verb === 'PATCH' || verb === 'DELETE') &&
    suffix &&
    !suffix.includes('/') &&
    !profileCollectionRoute(pathname, verb)
  ) {
    return 'native-profile-registry'
  }
  return 'native-http'
}

/** The profile a native grant is minted for: the URL's own selector, else a JSON body's `profile`.
 *  The sidebar names its owner in `recents_profile`; a named profile route in its first segment. */
export function nativeGrantProfile(url: string, body?: unknown, method?: string): string | null {
  const parsed = new URL(url)
  const collection = profileCollectionRoute(parsed.pathname, method)
  let scoped: string | null
  if (collection === 'sessions/sidebar') {
    scoped = parsed.searchParams.get('recents_profile')
  } else {
    const segment = profileRouteSuffix(parsed.pathname).split('/', 1)[0]
    scoped = segment && !collection ? safeDecode(segment) : parsed.searchParams.get('profile')
  }
  if (scoped?.trim()) return scoped.trim()
  const profile =
    body && typeof body === 'object' && !Array.isArray(body)
      ? (body as { profile?: unknown }).profile
      : undefined
  return typeof profile === 'string' && profile.trim() ? profile.trim() : null
}

function safeDecode(segment: string): string | null {
  try {
    return decodeURIComponent(segment)
  } catch {
    return null
  }
}

/** The interactive socket is the one shared-primary route: it selects every served sibling with
 *  a `profile` param, so it asks for a host-scoped grant. Every other ticket stays bound to the
 *  one profile it names. */
function ticketScope(purpose: GatewayTicketPurpose): { scope?: 'host' } {
  return purpose === 'interactive' ? { scope: 'host' } : {}
}

export async function mintLocalGatewayTicket(
  endpoint: GatewayEndpoint,
  purpose: GatewayTicketPurpose
): Promise<string> {
  if (process.platform === 'win32')
    throw new Error('Talyx cannot mint engine tickets on Windows yet')
  const home = endpoint.profile_id
  // A served secondary has no socket of its own: the multiplexer's control socket mints its
  // tickets (bound to the secondary's profile_id).
  const controlHome = endpoint.control_home || home
  for (const dir of new Set([home, controlHome])) {
    // Identity, not spelling: an advertised home is refused only when it leads somewhere else.
    if ((await reservedHome(dir)) !== dir) throw new Error('Noncanonical gateway profile')
    await privateNode(dir, 'home')
  }
  const socketPath = path.join(controlHome, 'gateway.sock')
  try {
    await privateNode(socketPath, 'socket')
  } catch (error) {
    // `gateway stop` unlinks the socket: the owner is gone, which the redial treats as stale.
    if (isMissingNodeError(error)) {
      const pointer = await fs.lstat(`${socketPath}.path`).catch(() => null)
      if (pointer)
        throw new Error(
          'This profile home is too long for a control socket; Talyx does not support that yet'
        )
      throw new Error('Gateway ticket control socket missing')
    }
    throw error
  }
  return requestTicket(
    socketPath,
    {
      protocol: 1,
      id: 1,
      verb: 'session-ticket',
      params: {
        profile_id: home,
        instance_id: endpoint.instance_id,
        purpose,
        ...ticketScope(purpose)
      }
    },
    endpoint
  )
}

function requestTicket(
  socketPath: string,
  request: object,
  endpoint: GatewayEndpoint
): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath)
    let buffer = ''
    const deadline = setTimeout(
      () => socket.destroy(new Error('Gateway ticket deadline')),
      TICKET_DEADLINE_MS
    )
    socket.on('error', () => reject(new Error('Gateway ticket bootstrap failed')))
    socket.on('close', () => {
      clearTimeout(deadline)
      reject(new Error('Gateway ticket connection closed'))
    })
    socket.on('connect', () => socket.write(JSON.stringify(request) + '\n'))
    socket.on('data', (chunk) => {
      buffer += chunk.toString()
      if (buffer.length > 65_536) {
        socket.destroy(new Error('Oversized gateway ticket response'))
        return
      }
      if (!buffer.includes('\n')) return
      try {
        const reply = JSON.parse(buffer.split('\n')[0]) as {
          ok?: boolean
          protocol?: number
          id?: number
          result?: { instance_id?: string; profile_id?: string; ticket?: unknown }
        }
        const grant = reply.result
        if (
          !reply.ok ||
          reply.protocol !== 1 ||
          reply.id !== 1 ||
          grant?.instance_id !== endpoint.instance_id ||
          grant?.profile_id !== endpoint.profile_id ||
          typeof grant?.ticket !== 'string'
        ) {
          throw new Error('Invalid gateway ticket')
        }
        resolve(grant.ticket)
      } catch {
        reject(new Error('Invalid gateway ticket response'))
      }
      socket.destroy()
    })
  })
}

// A profile home keeps the operator's mode: read/search bits grant nothing against the 0600
// socket; only write by another user could swap it. Upstream hands a group-writable home to the
// engine's Python bridge to prove the group private; Talyx refuses it instead.
async function privateNode(file: string, kind: 'home' | 'socket'): Promise<void> {
  const node = await fs.lstat(file)
  const quoted = `'${file.replace(/'/g, `'\\''`)}'`
  const valid = kind === 'home' ? node.isDirectory() : node.isSocket()
  if (!valid) {
    throw new Error(
      kind === 'home'
        ? `Unsafe gateway control path: profile home ${quoted} is not a directory`
        : `Unsafe gateway control path: ${quoted} should be a socket: remove it, then run talyx-engine gateway restart`
    )
  }
  const uid = process.getuid?.()
  if (node.uid !== uid) {
    throw new Error(
      `Unsafe gateway control path: ${quoted} is owned by uid ${node.uid}, not this user (uid ${uid})`
    )
  }
  const mode = (node.mode & 0o777).toString(8)
  if (kind === 'home' && node.mode & 0o022) {
    throw new Error(
      `Unsafe gateway control path: profile home ${quoted} is writable by other users (mode ${mode}): run chmod go-w ${quoted}`
    )
  }
  if (kind === 'socket' && node.mode & 0o077) {
    throw new Error(
      `Unsafe gateway control path: ${quoted} is accessible to other users (mode ${mode}): run chmod go-rwx ${quoted}`
    )
  }
}

function isMissingNodeError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException)?.code
  return code === 'ENOENT' || code === 'ENOTDIR'
}

/** Python's `posixpath.realpath`: ordinary components keep their spelling, a symlink is replaced
 *  by its target. Unlike Python it throws for a missing component. */
async function posixRealpath(dir: string): Promise<string> {
  const rest = dir.split('/').reverse()
  let resolved = dir.startsWith('/') ? '/' : process.cwd()
  let links = 0
  while (rest.length) {
    const name = rest.pop()
    if (!name || name === '.') continue
    if (name === '..') {
      resolved = resolved.slice(0, resolved.lastIndexOf('/')) || '/'
      continue
    }
    const next = resolved === '/' ? `/${name}` : `${resolved}/${name}`
    if (!(await fs.lstat(next)).isSymbolicLink()) {
      resolved = next
      continue
    }
    if (++links > 40)
      throw Object.assign(new Error(`Too many levels of symbolic links: ${dir}`), { code: 'ELOOP' })
    const target = await fs.readlink(next)
    if (target.startsWith('/')) resolved = '/'
    rest.push(...target.split('/').reverse())
  }
  return resolved
}

/** The home the gateway reserves for `dir`: its `Path.resolve()`. On POSIX that keeps the given
 *  spelling of every ordinary component, where macOS realpath(3) answers a case-insensitive
 *  volume in its stored letter case. */
export function reservedHome(dir: string): Promise<string> {
  return process.platform === 'win32' ? fs.realpath(dir) : posixRealpath(dir)
}
