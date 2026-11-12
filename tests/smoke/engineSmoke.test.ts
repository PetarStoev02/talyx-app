// The real-engine smoke test that gates every engine bump: the shipped install file installs the
// pinned engine into a fresh temp home, and Talyx's own engine code talks to it. Run with
// TALYX_SMOKE_INSTALL_FILE=<path to engine-install.json> npm run test:smoke; skipped otherwise.
// Never log CLI output here: it names the engine. Failures name the check, scrubbed of that name.
import { execFile } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { userInfo } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  createEngine,
  EngineHttpError,
  userBinEngine,
  type Engine
} from '../../src/main/infrastructure/engine/engine'
import { EngineSockets } from '../../src/main/infrastructure/engine/engineSockets'
import {
  mintLocalGatewayTicket,
  readEnsureResult,
  type GatewayEndpoint
} from '../../src/main/infrastructure/engine/gateway'
import { ENGINE_INSTALL_SHA256, sha256Hex } from '../../src/main/infrastructure/setup/installPin'
import { runInstall, type InstallRun } from '../../src/main/infrastructure/setup/installRunner'
import { metaPatch } from '../../src/renderer/src/shared/engine/botMeta'
import {
  EXPECTED_ENGINE_VERSION,
  parseEngineVersion,
  type EngineHttpRequest,
  type EngineStatus
} from '../../src/shared/engine'
import { insideHome, isolatedEnv, isolatedRun, makeTempHome } from './isolation'

const INSTALL_FILE = process.env.TALYX_SMOKE_INSTALL_FILE ?? null
// The `groups.capabilities` protocol_version of the vendored client's last re-sync (observed on
// engine 0.22.7); update it with the client.
const ROOMS_PROTOCOL_VERSION = 2
// The manager bot's profile, which the providers page reads (useProvidersBackend's HOME_PROFILE).
const HOME_PROFILE = 'default'
const SMOKE_PROFILE = 'talyx-smoke-1'
const SMOKE_SOUL = '# Smoke\n\nA throwaway bot the smoke test creates and deletes.'
const SMOKE_META = { title: 'Smoke' }
const SOCKET_ID = 'smoke-socket'
const RPC_TIMEOUT_MS = 30_000
const PROCESS_EXIT_WAIT_MS = 10_000
const PROCESS_POLL_MS = 500
const CHECKS = [
  'install file',
  'install',
  'version',
  'attach inside the temp home',
  'socket profiles.list',
  'rooms protocol',
  'throwaway profile',
  'routines',
  'roster REST',
  'providers REST',
  'delete throwaway profile',
  'no service unit'
] as const

type Check = (typeof CHECKS)[number]
type Attached = Extract<EngineStatus, { state: 'attached' }>
type Rpc = (profile: string, method: string, params: Record<string, unknown>) => Promise<unknown>

/** A failure message the smoke test wrote itself, so it never carries engine output. */
class SmokeFailure extends Error {}

const InstallFileSchema = z.object({
  engineVersion: z.string(),
  platforms: z.record(z.string(), z.object({ commands: z.array(z.string()).min(1) }))
})
const ProfileRowsSchema = z.object({
  profiles: z.array(
    z.object({
      name: z.string(),
      ui_meta: z.record(z.string(), z.unknown()).nullish(),
      ui_meta_revisions: z.record(z.string(), z.number()).nullish()
    })
  )
})
// The fields Talyx reads from each call: the roster's profile names, the providers page, routines.
const RestProfilesSchema = z.object({ profiles: z.array(z.object({ name: z.string() })) })
const RestEnvSchema = z.record(
  z.string(),
  z.object({
    category: z.string(),
    is_set: z.boolean(),
    is_password: z.boolean(),
    advanced: z.boolean(),
    provider: z.string().nullish(),
    provider_label: z.string().nullish(),
    url: z.string().nullish(),
    redacted_value: z.string().nullish()
  })
)
const RestCustomEndpointsSchema = z.object({
  endpoints: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      base_url: z.string(),
      models: z.array(z.string()),
      has_api_key: z.boolean(),
      source: z.string().nullish()
    })
  )
})
const RestOAuthSchema = z.object({
  providers: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      flow: z.string(),
      cli_command: z.string(),
      disconnectable: z.boolean().nullish(),
      status: z
        .object({ logged_in: z.boolean().nullish(), free_tier: z.boolean().nullish() })
        .nullish()
    })
  )
})
const RestModelInfoSchema = z.object({
  model: z.string().nullish(),
  provider: z.string().nullish()
})
// routines.ts: `cron.manage` reports its own failures inside a successful result.
const CronOutcomeSchema = z.object({
  success: z.boolean().nullish(),
  error: z.string().nullish()
})
const CronListSchema = z.object({
  jobs: z
    .array(
      z.object({
        job_id: z.string(),
        name: z.string().nullish(),
        schedule: z.string().nullish(),
        deliver: z.string().nullish(),
        enabled: z.boolean().nullish(),
        state: z.string().nullish()
      })
    )
    .nullish()
})

const passed: (Check | 'teardown')[] = []
let engineName: string | null = null
let home: string | null = null
let sockets: EngineSockets | null = null
let installRun: InstallRun | null = null
let installHash: string | null = null
let roomsProtocol: number | null = null

describe.skipIf(INSTALL_FILE === null)('real engine smoke', () => {
  afterAll(async () => {
    try {
      if (home) await check('teardown', () => tearDown(home!))
    } finally {
      // stderr, not console.log: vitest hides the log of a passing run, and the README asks for
      // this line to be pasted in the PR.
      process.stderr.write(
        `Smoke summary: install file sha256 ${installHash ?? 'unread'}; rooms protocol_version ` +
          `${roomsProtocol ?? 'unread'}; passed: ${passed.join(', ')}\n`
      )
    }
  })

  it('should pass every check against the pinned engine in a temp home', async () => {
    const units = serviceUnits()
    const file = await check('install file', async () => readInstallFile(INSTALL_FILE!))
    home = makeTempHome()
    const enginePath = userBinEngine(process.platform, home)
    const run = isolatedRun(home)
    await check('install', () => install(home!, file.commands))
    await check('version', () => checkVersion(run, enginePath, file))
    const engine = createEngine({
      enginePath: () => enginePath,
      home,
      run,
      platform: process.platform,
      pathEnv: isolatedEnv(home).PATH,
      // Every endpoint Talyx mints for, a stale re-ensure's included, must be inside the temp home.
      mintTicket: (endpoint, purpose) => {
        assertInsideHome(endpoint)
        return mintLocalGatewayTicket(endpoint, purpose)
      }
    })
    const status = await check('attach inside the temp home', () =>
      checkAttach(engine, run, enginePath)
    )
    sockets = new EngineSockets(engine)
    const rpc = await check('socket profiles.list', () => checkProfilesList(sockets!))
    roomsProtocol = await check('rooms protocol', () => checkRoomsProtocol(rpc))
    await check('throwaway profile', () => checkThrowawayProfile(rpc, status.botMetaKey))
    await check('routines', () => checkRoutines(rpc))
    await check('roster REST', () => checkRosterRest(engine))
    await check('providers REST', () => checkProvidersRest(engine))
    await check('delete throwaway profile', () => deleteThrowawayProfile(engine, rpc))
    await check('no service unit', async () => checkNoNewServiceUnit(units))
    // A check that did not run is a failure, not a pass.
    expect(passed).toEqual([...CHECKS])
  })
})

async function check<T>(name: Check | 'teardown', body: () => Promise<T>): Promise<T> {
  let result: T
  try {
    result = await body()
  } catch (error) {
    throw new SmokeFailure(`Smoke check "${name}" failed: ${safeDetail(error)}`)
  }
  passed.push(name)
  return result
}

// Engine output may name the engine; until its name is known, keep only the error's kind.
function safeDetail(error: unknown): string {
  if (error instanceof SmokeFailure) return error.message
  if (!(error instanceof Error)) return 'a non-error was thrown'
  if (!engineName) return error.name
  const name = engineName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return error.message.replace(new RegExp(name, 'gi'), 'the engine')
}

function readInstallFile(path: string): { commands: string[]; version: string; commit: string } {
  const bytes = readFileSync(path)
  installHash = sha256Hex(bytes)
  if (installHash !== ENGINE_INSTALL_SHA256)
    throw new SmokeFailure('its hash is not the ENGINE_INSTALL_SHA256 Talyx pins')
  const file = InstallFileSchema.parse(JSON.parse(bytes.toString('utf8')))
  const commands = file.platforms[process.platform]?.commands
  if (!commands) throw new SmokeFailure(`no commands for ${process.platform}`)
  const commits = new Set(commands.join('\n').match(/\b[0-9a-f]{40}\b/g))
  if (commits.size !== 1) throw new SmokeFailure(`${commits.size} pinned commits, expected one`)
  return { commands, version: file.engineVersion, commit: [...commits][0] }
}

async function install(home: string, commands: string[]): Promise<void> {
  const env = isolatedEnv(home)
  installRun = runInstall(commands, () => undefined, '/bin/bash', { env, login: false })
  const exit = await installRun.done
  if (exit.kind === 'failed')
    throw new SmokeFailure(`command ${exit.index + 1} exited with ${exit.code}`)
  if (exit.kind !== 'ok') throw new SmokeFailure(exit.kind)
}

async function checkVersion(
  run: ReturnType<typeof isolatedRun>,
  enginePath: string,
  file: { version: string; commit: string }
): Promise<void> {
  const found = parseEngineVersion((await run(enginePath, ['--version'])).stdout)
  engineName = found.name
  if (found.version !== file.version || found.version !== EXPECTED_ENGINE_VERSION)
    throw new SmokeFailure(
      `version ${found.version}, pinned ${file.version}, Talyx expects ${EXPECTED_ENGINE_VERSION}`
    )
  if (!found.commit || !file.commit.startsWith(found.commit))
    throw new SmokeFailure(`commit ${found.commit}, pinned ${file.commit.slice(0, 7)}`)
}

// Before any ticket is minted: the gateway this engine ensures must live inside the temp home.
async function checkAttach(
  engine: Engine,
  run: ReturnType<typeof isolatedRun>,
  enginePath: string
): Promise<Attached> {
  const ensureArgs = ['--profile', 'default', 'gateway', 'ensure', '--json']
  const { endpoint } = readEnsureResult(await run(enginePath, ensureArgs))
  assertInsideHome(endpoint)
  const status = await engine.status()
  if (status.state !== 'attached')
    throw new SmokeFailure(
      `status ${status.state}${status.state === 'error' ? ` (${status.reason})` : ''}`
    )
  if (status.stale) throw new SmokeFailure('the gateway is stale')
  if (status.home !== endpoint.profile_id) throw new SmokeFailure('status names another home')
  return status
}

function assertInsideHome(endpoint: GatewayEndpoint): void {
  for (const path of [endpoint.profile_id, endpoint.control_home]) {
    if (path && !insideHome(home!, path))
      throw new SmokeFailure('a gateway endpoint is outside the temp home')
  }
}

async function checkProfilesList(engineSockets: EngineSockets): Promise<Rpc> {
  const rpc = await openRpc(engineSockets)
  const { profiles } = ProfileRowsSchema.parse(
    await rpc('default', 'profiles.list', { include_sessions: true })
  )
  if (!profiles.some((row) => row.name === 'default'))
    throw new SmokeFailure('no default profile listed')
  return rpc
}

async function checkRoomsProtocol(rpc: Rpc): Promise<number> {
  const { protocol_version: version } = z
    .object({ protocol_version: z.number() })
    .parse(await rpc('default', 'groups.capabilities', {}))
  if (version !== ROOMS_PROTOCOL_VERSION)
    throw new SmokeFailure(`protocol_version ${version}, expected ${ROOMS_PROTOCOL_VERSION}`)
  return version
}

// Create, file (ui_meta round trip, the way the roster saves it), describe and list sessions.
async function checkThrowawayProfile(rpc: Rpc, botMetaKey: string): Promise<void> {
  await rpc('default', 'profiles.create', { name: SMOKE_PROFILE, soul: SMOKE_SOUL, no_alias: true })
  const row = await profileRow(rpc)
  if (!row.ui_meta_revisions) throw new SmokeFailure('no ui_meta_revisions, saves are unsafe')
  const revision = row.ui_meta_revisions[botMetaKey] ?? 0
  const saved = z
    .object({ applied: z.object({ ui_meta: z.boolean().nullish() }) })
    .parse(
      await rpc(
        SMOKE_PROFILE,
        'profiles.configure',
        metaPatch(SMOKE_PROFILE, { [botMetaKey]: { meta: SMOKE_META, revision } })
      )
    )
  if (saved.applied.ui_meta !== true) throw new SmokeFailure('ui_meta was not applied')
  expect((await profileRow(rpc)).ui_meta?.[botMetaKey]).toEqual(SMOKE_META)
  const { soul } = z
    .object({ soul: z.string() })
    .parse(await rpc(SMOKE_PROFILE, 'profiles.describe', { name: SMOKE_PROFILE }))
  if (!soul.includes('# Smoke')) throw new SmokeFailure('describe did not return the soul')
  z.object({ sessions: z.array(z.unknown()) }).parse(
    await rpc(SMOKE_PROFILE, 'session.list', { limit: 1 })
  )
}

async function profileRow(rpc: Rpc): Promise<z.infer<typeof ProfileRowsSchema>['profiles'][0]> {
  const { profiles } = ProfileRowsSchema.parse(
    await rpc(SMOKE_PROFILE, 'profiles.list', { include_sessions: false })
  )
  const row = profiles.find((item) => item.name === SMOKE_PROFILE)
  if (!row) throw new SmokeFailure('the throwaway profile is not listed')
  return row
}

// routines.ts `listRoutines`: the bot's own cron store over the `cron.manage` RPC.
async function checkRoutines(rpc: Rpc): Promise<void> {
  const result = await rpc(SMOKE_PROFILE, 'cron.manage', { action: 'list', include_disabled: true })
  const outcome = CronOutcomeSchema.safeParse(result)
  if (outcome.success && (outcome.data.success === false || outcome.data.error))
    throw new SmokeFailure('cron.manage list reported a failure')
  CronListSchema.parse(result)
}

// useProvidersBackend.ts `listProfiles`: unscoped.
async function checkRosterRest(engine: Engine): Promise<void> {
  const { profiles } = RestProfilesSchema.parse(await rest(engine, { path: '/api/profiles' }))
  const names = profiles.map((profile) => profile.name)
  if (!names.includes('default') || !names.includes(SMOKE_PROFILE))
    throw new SmokeFailure('/api/profiles is missing a profile')
}

// providers.ts `loadProviders`: each path scoped to the home profile, which also rides the request.
async function checkProvidersRest(engine: Engine): Promise<void> {
  const read = (path: string): Promise<unknown> =>
    rest(engine, { path: scoped(path, HOME_PROFILE), profile: HOME_PROFILE })
  RestEnvSchema.parse(await read('/api/env'))
  RestCustomEndpointsSchema.parse(await read('/api/providers/custom-endpoints'))
  RestOAuthSchema.parse(await read('/api/providers/oauth'))
  RestModelInfoSchema.parse(await read('/api/model/info'))
}

function scoped(path: string, profile: string): string {
  return `${path}?${new URLSearchParams({ profile })}`
}

/** One REST call; a failure names the call. */
async function rest(engine: Engine, request: EngineHttpRequest): Promise<unknown> {
  try {
    return await engine.http(request)
  } catch (error) {
    const call = `${request.method ?? 'GET'} ${request.path}`
    const status = error instanceof EngineHttpError ? ` HTTP ${error.status}` : ''
    throw new SmokeFailure(`${call}:${status} ${safeDetail(error)}`)
  }
}

async function deleteThrowawayProfile(engine: Engine, rpc: Rpc): Promise<void> {
  await rest(engine, { path: `/api/profiles/${SMOKE_PROFILE}`, method: 'DELETE' })
  const { profiles } = ProfileRowsSchema.parse(
    await rpc('default', 'profiles.list', { include_sessions: false })
  )
  if (profiles.some((row) => row.name === SMOKE_PROFILE))
    throw new SmokeFailure('the throwaway profile is still listed')
}

// `--non-interactive` skips the gateway service stage: no launchd or systemd unit may appear.
// Reads the real directories' names only; never prints them (a unit's name may name the engine).
function serviceUnits(): string[] {
  const dirs = [
    join(userInfo().homedir, 'Library', 'LaunchAgents'),
    join(userInfo().homedir, '.config', 'systemd', 'user')
  ]
  return dirs.flatMap((dir) => (existsSync(dir) ? readdirSync(dir).map((n) => join(dir, n)) : []))
}

function checkNoNewServiceUnit(before: string[]): void {
  const added = serviceUnits().filter((unit) => !before.includes(unit))
  if (added.length) throw new SmokeFailure(`${added.length} new service unit(s) appeared`)
}

/** JSON-RPC over one gateway socket opened by main's own EngineSockets, as the app does. */
async function openRpc(engineSockets: EngineSockets): Promise<Rpc> {
  const pending = new Map<
    number,
    { method: string; settle: (error: Error | null, result?: unknown) => void }
  >()
  let nextId = 1
  await engineSockets.open(SOCKET_ID, 'default', (channel, _id, text) => {
    if (channel === 'engine:socket-closed') {
      for (const waiter of pending.values()) waiter.settle(new SmokeFailure('the socket closed'))
      return
    }
    let frame: { id?: unknown; result?: unknown; error?: { code?: number } }
    try {
      frame = JSON.parse(String(text))
    } catch {
      // Not a JSON-RPC frame, so no waiter's; its parse error would quote engine text.
      return
    }
    const waiter = typeof frame.id === 'number' ? pending.get(frame.id) : undefined
    if (!waiter) return
    if (frame.error)
      waiter.settle(
        new SmokeFailure(`${waiter.method}: RPC error ${frame.error.code ?? 'unknown'}`)
      )
    else waiter.settle(null, frame.result)
  })
  return (profile, method, params) =>
    new Promise((resolve, reject) => {
      const id = nextId++
      const timer = setTimeout(
        () => settle(new SmokeFailure(`${method} got no answer`)),
        RPC_TIMEOUT_MS
      )
      const settle = (error: Error | null, result?: unknown): void => {
        clearTimeout(timer)
        pending.delete(id)
        if (error) reject(error)
        else resolve(result)
      }
      pending.set(id, { method, settle })
      engineSockets.send(
        SOCKET_ID,
        JSON.stringify({ jsonrpc: '2.0', id, method, params: { ...params, profile } })
      )
    })
}

// Always runs (afterAll): close the socket, stop an unfinished install, stop the temp home's
// gateway, require that no process still references the temp home, then delete it. A failed stop
// still gets the leftover-process check. Touches nothing outside the temp home.
async function tearDown(tempHome: string): Promise<void> {
  const problems: string[] = []
  try {
    sockets?.closeAll()
    if (installRun) {
      installRun.cancel()
      await installRun.done
    }
    const enginePath = userBinEngine(process.platform, tempHome)
    if (existsSync(enginePath)) {
      await isolatedRun(tempHome)(enginePath, ['gateway', 'stop']).catch((error: unknown) => {
        problems.push(`gateway stop failed (${safeDetail(error)})`)
      })
    }
    const left = await processesReferencing(tempHome)
    if (left) problems.push(`${left} process(es) still reference the temp home`)
  } finally {
    rmSync(tempHome, { recursive: true, force: true })
  }
  if (problems.length) throw new SmokeFailure(problems.join('; '))
}

async function processesReferencing(tempHome: string): Promise<number> {
  const deadline = Date.now() + PROCESS_EXIT_WAIT_MS
  for (;;) {
    const count = await pgrepCount(tempHome)
    if (count === 0 || Date.now() > deadline) return count
    await new Promise((resolve) => setTimeout(resolve, PROCESS_POLL_MS))
  }
}

function pgrepCount(pattern: string): Promise<number> {
  return new Promise((resolve, reject) => {
    execFile('pgrep', ['-f', pattern], (error, stdout) => {
      // pgrep exits 1 when nothing matches.
      if (error && error.code === 1) return resolve(0)
      if (error) return reject(error)
      resolve(stdout.trim().split('\n').length)
    })
  })
}
