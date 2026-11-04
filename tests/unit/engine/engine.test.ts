import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from 'fs'
import { createServer, type Server } from 'net'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createEngine,
  engineCandidates,
  EngineHttpError,
  EngineRouteError,
  type EngineDeps
} from '../../../src/main/infrastructure/engine/engine'
import {
  mintLocalGatewayTicket,
  routedGatewayEndpoint,
  type CliResult,
  type GatewayEndpoint
} from '../../../src/main/infrastructure/engine/gateway'
import { engineWire, parseEngineVersion } from '../../../src/shared/engine'

// A made-up engine: the real one's name is never written in this repo.
const VERSION_LINE =
  'Acme Agent v1.2.3 (2026.9.24) · stable · local abcdef1234ab\nInstall directory: /x'
const HOME = '/home/u/.acme'

function endpointFixture(overrides: Partial<GatewayEndpoint> = {}): GatewayEndpoint {
  return {
    profile_id: HOME,
    instance_id: 'instance-1',
    authority_epoch: 1,
    runtime_protocol: 1,
    api_origin: 'http://127.0.0.1:4567',
    capabilities: ['session-authority-v1'],
    supervisor: 'none',
    control_home: null,
    code_sha: 'abc',
    ...overrides
  }
}

function ensureOutput(
  endpoint: GatewayEndpoint = endpointFixture(),
  extra: object = {}
): CliResult {
  return {
    code: 0,
    stdout: JSON.stringify({ state: 'ready', client_code_sha: 'abc', endpoint, ...extra }),
    stderr: ''
  }
}

function notFound(): Error {
  return Object.assign(new Error('spawn ENOENT'), { code: 'ENOENT' })
}

/** An engine whose CLI answers `--version` and `gateway ensure` with the given results. */
function engineWith(overrides: Partial<EngineDeps> & { ensure?: () => CliResult } = {}): {
  engine: ReturnType<typeof createEngine>
  run: ReturnType<typeof vi.fn>
} {
  const run = vi.fn(
    async (_command: string, args: string[]): Promise<CliResult> =>
      args[0] === '--version'
        ? { code: 0, stdout: VERSION_LINE, stderr: '' }
        : (overrides.ensure ?? (() => ensureOutput()))()
  )
  const engine = createEngine({
    enginePath: () => null,
    run,
    mintTicket: async () => 'ticket-1',
    platform: 'darwin',
    home: '/home/u',
    ...overrides
  })
  return { engine, run }
}

describe('engine command', () => {
  it('should try the chosen file first, then still look on PATH and in the user bin', () => {
    expect(engineCandidates('/opt/engine/bin/cli', 'darwin', '/home/u')).toEqual([
      '/opt/engine/bin/cli',
      'talyx-engine',
      '/home/u/.local/bin/talyx-engine'
    ])
  })

  it('should explain a command that exists but cannot run, instead of calling it missing', async () => {
    const run = vi.fn(async () => {
      throw Object.assign(new Error('spawn EACCES'), { code: 'EACCES' })
    })
    expect(await engineWith({ run }).engine.status()).toEqual({
      state: 'error',
      message: 'spawn EACCES'
    })
  })

  it.each([
    ['darwin', '/home/u/.local/bin/talyx-engine'],
    ['linux', '/home/u/.local/bin/talyx-engine'],
    ['win32', '/home/u/.local/bin/talyx-engine.exe']
  ] as const)('should look on PATH, then in the user bin on %s', (platform, userBin) => {
    expect(engineCandidates(null, platform, '/home/u')).toEqual(['talyx-engine', userBin])
  })

  it('should fall back to the user bin when PATH has no talyx-engine', async () => {
    const run = vi.fn(async (command: string, args: string[]) => {
      if (command === 'talyx-engine') throw notFound()
      return args[0] === '--version'
        ? { code: 0, stdout: VERSION_LINE, stderr: '' }
        : ensureOutput()
    })
    const status = await engineWith({ run }).engine.status()
    expect(status.state).toBe('attached')
    expect(run).toHaveBeenLastCalledWith('/home/u/.local/bin/talyx-engine', [
      '--profile',
      'default',
      'gateway',
      'ensure',
      '--json'
    ])
  })
})

describe('engine version and wire strings', () => {
  it('should read the name, version and short commit from the version line', () => {
    expect(parseEngineVersion(VERSION_LINE)).toEqual({
      name: 'acme',
      version: '1.2.3',
      commit: 'abcdef1'
    })
  })

  it('should refuse output that is not a version line', () => {
    expect(() => parseEngineVersion('Traceback (most recent call last):')).toThrow(
      /Unrecognized engine/
    )
  })

  it('should build every wire string from the engine name', () => {
    expect(engineWire('acme')).toEqual({
      wsProtocol: 'acme-gateway-v1',
      wsTicketPrefix: 'acme-gateway-ticket.',
      ticketHeader: 'X-Acme-Gateway-Ticket',
      botMetaKey: 'acme-bots',
      botGroupsMetaKey: 'acme-bots-groups'
    })
  })
})

describe('engine status', () => {
  it('should say Windows cannot attach yet instead of opening a gate it cannot serve', async () => {
    const { engine, run } = engineWith({ platform: 'win32' })
    expect(await engine.status()).toEqual({
      state: 'error',
      message: 'Talyx cannot attach to the engine on Windows yet'
    })
    expect(run).not.toHaveBeenCalled()
  })

  it('should report missing when no candidate runs', async () => {
    const run = vi.fn(async () => {
      throw notFound()
    })
    expect(await engineWith({ run }).engine.status()).toEqual({
      state: 'missing',
      enginePath: null
    })
  })

  it('should attach to the gateway ensure reports and pass the metadata keys on', async () => {
    expect(await engineWith().engine.status()).toEqual({
      state: 'attached',
      version: '1.2.3',
      commit: 'abcdef1',
      home: HOME,
      stale: false,
      botMetaKey: 'acme-bots',
      botGroupsMetaKey: 'acme-bots-groups'
    })
  })

  it('should flag a gateway that runs other code than the CLI, and still attach', async () => {
    const status = await engineWith({
      ensure: () => ensureOutput(endpointFixture({ code_sha: 'old' }))
    }).engine.status()
    expect(status).toMatchObject({ state: 'attached', stale: true })
  })

  it.each([
    ['a non-loopback origin', endpointFixture({ api_origin: 'http://10.0.0.2:4567' })],
    ['no session authority', endpointFixture({ capabilities: [] })],
    ['another runtime protocol', endpointFixture({ runtime_protocol: 2 })]
  ])('should refuse an endpoint with %s', async (_case, endpoint) => {
    const status = await engineWith({ ensure: () => ensureOutput(endpoint) }).engine.status()
    expect(status).toEqual({ state: 'error', message: 'Invalid local gateway endpoint' })
  })

  it('should explain an ensure that printed nothing with its last stderr line', async () => {
    const status = await engineWith({
      ensure: () => ({ code: 2, stdout: '', stderr: 'boot\nProfile not found' })
    }).engine.status()
    expect(status).toMatchObject({
      state: 'error',
      message: expect.stringContaining('Profile not found')
    })
  })

  it('should name the recovery command when the gateway is not ready', async () => {
    const status = await engineWith({
      ensure: () => ({
        code: 3,
        stdout: JSON.stringify({ state: 'incompatible', reason_code: 'version_skew' }),
        stderr: ''
      })
    }).engine.status()
    expect(status).toMatchObject({
      state: 'error',
      message: 'Gateway incompatible (version_skew). Use talyx-engine gateway status for recovery.'
    })
  })
})

describe('profile routing', () => {
  it.each([
    ['default', HOME],
    ['current', HOME],
    ['cfo', `${HOME}/profiles/cfo`]
  ])('should route %s to its profile home', (profile, home) => {
    expect(routedGatewayEndpoint(endpointFixture(), profile).profile_id).toBe(home)
  })

  it('should mint a sibling ticket through the root control socket', () => {
    expect(routedGatewayEndpoint(endpointFixture(), 'cfo').control_home).toBe(HOME)
  })

  it('should refuse a profile name that could leave the profiles folder', () => {
    expect(() => routedGatewayEndpoint(endpointFixture(), '../etc')).toThrow(
      'Invalid profile route'
    )
  })
})

describe('tickets and REST', () => {
  it('should re-ensure once when the attached gateway is gone', async () => {
    const mintTicket = vi
      .fn()
      .mockRejectedValueOnce(new Error('Gateway ticket control socket missing'))
      .mockResolvedValueOnce('fresh')
    const { engine, run } = engineWith({ mintTicket })
    expect((await engine.mint('default', 'interactive')).ticket).toBe('fresh')
    expect(run.mock.calls.filter(([, args]) => args.includes('ensure'))).toHaveLength(2)
  })

  it('should send the ticket header the engine name implies, scoped to the URL profile', async () => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'talyx-root-')))
    mkdirSync(join(root, 'profiles', 'cfo'), { recursive: true })
    const fetchFn = vi.fn(async () => new Response('{"ok":true}', { status: 200 }))
    const mintTicket = vi.fn(async () => 'grant')
    const { engine } = engineWith({
      fetch: fetchFn as unknown as typeof fetch,
      mintTicket,
      ensure: () => ensureOutput(endpointFixture({ profile_id: root }))
    })
    expect(await engine.http({ path: '/api/profiles/cfo', method: 'DELETE' })).toEqual({ ok: true })
    const [url, init] = fetchFn.mock.calls[0] as unknown as [URL, RequestInit]
    expect(url.toString()).toBe('http://127.0.0.1:4567/api/profiles/cfo')
    expect(init.headers).toEqual({ 'X-Acme-Gateway-Ticket': 'grant' })
    expect(mintTicket).toHaveBeenCalledWith(
      expect.objectContaining({ profile_id: `${root}/profiles/cfo` }),
      'native-profile-registry'
    )
    rmSync(root, { recursive: true, force: true })
  })

  it('should send a request to the gateway that answered the re-ensure, not the old port', async () => {
    let ensures = 0
    const fetchFn = vi.fn(async () => new Response('[]', { status: 200 }))
    const mintTicket = vi
      .fn()
      .mockRejectedValueOnce(new Error('Gateway ticket control socket missing'))
      .mockResolvedValueOnce('fresh')
    const { engine } = engineWith({
      fetch: fetchFn as unknown as typeof fetch,
      mintTicket,
      ensure: () =>
        ensureOutput(
          endpointFixture({
            api_origin: ++ensures === 1 ? 'http://127.0.0.1:4567' : 'http://127.0.0.1:5678'
          })
        )
    })
    await engine.http({ path: '/api/cron/jobs?profile=default' })
    const [url] = fetchFn.mock.calls[0] as unknown as [URL]
    expect(url.toString()).toBe('http://127.0.0.1:5678/api/cron/jobs?profile=default')
  })

  it.each(['/api/..//evil.example/steal?x=1', '/api/%2e%2e//evil.example/x', '/api/../other'])(
    'should never send the ticket for a path that resolves outside the gateway API (%s)',
    async (path) => {
      const fetchFn = vi.fn(async () => new Response('{}', { status: 200 }))
      const mintTicket = vi.fn(async () => 'grant')
      const { engine } = engineWith({ fetch: fetchFn as unknown as typeof fetch, mintTicket })
      await expect(engine.http({ path })).rejects.toBeInstanceOf(EngineRouteError)
      expect(mintTicket).not.toHaveBeenCalled()
      expect(fetchFn).not.toHaveBeenCalled()
    }
  )

  it('should keep a doubled slash on the gateway host', async () => {
    const fetchFn = vi.fn(async () => new Response('{}', { status: 200 }))
    const { engine } = engineWith({ fetch: fetchFn as unknown as typeof fetch })
    await engine.http({ path: '/api//evil.example/x' })
    const [url] = fetchFn.mock.calls[0] as unknown as [URL]
    expect(url.origin).toBe('http://127.0.0.1:4567')
  })

  it('should raise the gateway detail of a failed request', async () => {
    const fetchFn = vi.fn(async () => new Response('{"detail":"Profile busy"}', { status: 409 }))
    const { engine } = engineWith({ fetch: fetchFn as unknown as typeof fetch })
    await expect(engine.http({ path: '/api/profiles' })).rejects.toEqual(
      new EngineHttpError(409, 'Profile busy')
    )
  })
})

describe('control socket ticket', () => {
  let dir: string
  let server: Server | null = null

  afterEach(async () => {
    await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()))
    server = null
    rmSync(dir, { recursive: true, force: true })
  })

  /** A profile home whose control socket answers `session-ticket` with `reply`. */
  async function homeAnswering(
    reply: (request: { params: Record<string, string> }) => object
  ): Promise<string> {
    // realpath: the gateway reserves resolved homes (macOS tmp lives behind a symlink)
    dir = realpathSync(mkdtempSync(join(tmpdir(), 'talyx-home-')))
    const home = join(dir, 'h')
    mkdirSync(home, { mode: 0o700 })
    const socketPath = join(home, 'gateway.sock')
    server = createServer((socket) =>
      socket.on('data', (chunk) => {
        socket.end(JSON.stringify(reply(JSON.parse(chunk.toString()))) + '\n')
      })
    )
    await new Promise<void>((resolve) => server!.listen(socketPath, resolve))
    chmodSync(socketPath, 0o600)
    return home
  }

  it('should return the grant the control socket mints for this instance', async () => {
    const home = await homeAnswering((request) => ({
      ok: true,
      protocol: 1,
      id: 1,
      result: { instance_id: 'instance-1', profile_id: request.params.profile_id, ticket: 't-1' }
    }))
    expect(await mintLocalGatewayTicket(endpointFixture({ profile_id: home }), 'interactive')).toBe(
      't-1'
    )
  })

  it('should refuse a grant for another gateway instance', async () => {
    const home = await homeAnswering((request) => ({
      ok: true,
      protocol: 1,
      id: 1,
      result: { instance_id: 'other', profile_id: request.params.profile_id, ticket: 't-1' }
    }))
    await expect(
      mintLocalGatewayTicket(endpointFixture({ profile_id: home }), 'interactive')
    ).rejects.toThrow('Invalid gateway ticket response')
  })

  it('should refuse a control socket other users can open', async () => {
    const home = await homeAnswering(() => ({}))
    chmodSync(join(home, 'gateway.sock'), 0o666)
    await expect(
      mintLocalGatewayTicket(endpointFixture({ profile_id: home }), 'interactive')
    ).rejects.toThrow('is accessible to other users')
  })

  it('should refuse a profile home other users can write to', async () => {
    const home = await homeAnswering(() => ({}))
    chmodSync(home, 0o775)
    await expect(
      mintLocalGatewayTicket(endpointFixture({ profile_id: home }), 'interactive')
    ).rejects.toThrow('is writable by other users')
  })

  it('should treat a missing control socket as a stopped gateway', async () => {
    dir = realpathSync(mkdtempSync(join(tmpdir(), 'talyx-home-')))
    await expect(
      mintLocalGatewayTicket(endpointFixture({ profile_id: dir }), 'interactive')
    ).rejects.toThrow('Gateway ticket control socket missing')
  })
})
