import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'

const electronApp = vi.hoisted(() => ({ isPackaged: true, getVersion: (): string => '1.2.3' }))
vi.mock('electron', () => ({ app: electronApp }))
vi.mock('electron-log', () => ({ default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }))

import {
  ENGINE_INSTALL_SHA256,
  installStepsSource,
  loadInstallSteps,
  type InstallStepsSource
} from '../../../src/main/infrastructure/setup/installSteps'

const RELEASE_URL = 'https://example.test/releases/tag/v0.0.0'

function bytesOf(file: unknown): Uint8Array {
  return new TextEncoder().encode(typeof file === 'string' ? file : JSON.stringify(file))
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function sourceFor(
  bytes: Uint8Array,
  overrides: Partial<InstallStepsSource> = {}
): InstallStepsSource {
  return {
    read: () => Promise.resolve(bytes),
    expectedSha256: sha256(bytes),
    platform: 'darwin',
    releaseUrl: RELEASE_URL,
    ...overrides
  }
}

const FILE = {
  schema: 1,
  engineVersion: '0.22.5',
  platforms: {
    darwin: { commands: ['echo one', 'echo two'] },
    linux: { commands: ['echo linux'] }
  }
}

describe('loadInstallSteps', () => {
  it('should hand over the commands for this platform when the hash matches', async () => {
    const result = await loadInstallSteps(sourceFor(bytesOf(FILE)))

    expect(result).toEqual({
      kind: 'ready',
      commands: ['echo one', 'echo two'],
      engineVersion: '0.22.5',
      releaseUrl: RELEASE_URL
    })
  })

  it('should refuse a file whose bytes differ from the pinned hash', async () => {
    const pinned = sha256(bytesOf(FILE))
    const tampered = bytesOf(FILE)
    tampered[tampered.length - 2] ^= 1

    const result = await loadInstallSteps(sourceFor(tampered, { expectedSha256: pinned }))

    expect(result).toEqual({ kind: 'mismatch', releaseUrl: RELEASE_URL })
  })

  it('should report the steps unavailable when reading fails', async () => {
    const result = await loadInstallSteps(
      sourceFor(bytesOf(FILE), { read: () => Promise.reject(new Error('offline')) })
    )

    expect(result).toEqual({ kind: 'unavailable', releaseUrl: RELEASE_URL })
  })

  it('should call a file without this platform invalid', async () => {
    const linuxOnly = { ...FILE, platforms: { linux: FILE.platforms.linux } }

    const result = await loadInstallSteps(sourceFor(bytesOf(linuxOnly)))

    expect(result).toEqual({ kind: 'invalid', releaseUrl: RELEASE_URL })
  })

  it('should call a file that is not JSON invalid when its hash matches', async () => {
    const result = await loadInstallSteps(sourceFor(bytesOf('not json')))

    expect(result).toEqual({ kind: 'invalid', releaseUrl: RELEASE_URL })
  })

  it('should not read anything on Windows', async () => {
    const read = vi.fn()

    const result = await loadInstallSteps(sourceFor(bytesOf(FILE), { read, platform: 'win32' }))

    expect(result).toEqual({ kind: 'unsupported', releaseUrl: RELEASE_URL })
    expect(read).not.toHaveBeenCalled()
  })
})

describe('ENGINE_INSTALL_SHA256', () => {
  it('should pin a SHA-256', () => {
    expect(ENGINE_INSTALL_SHA256).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('installStepsSource', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubFetch(body: Uint8Array): ReturnType<typeof vi.fn> {
    const fetch = vi.fn(() => Promise.resolve(new Response(body)))
    vi.stubGlobal('fetch', fetch)
    return fetch
  }

  it('should fetch the file from the release of this version, never the latest one', async () => {
    const fetch = stubFetch(bytesOf(FILE))

    const source = installStepsSource()
    await source.read()

    expect(fetch).toHaveBeenCalledWith(
      'https://github.com/PetarStoev02/talyx-app/releases/download/v1.2.3/engine-install.json',
      expect.anything()
    )
    expect(source.releaseUrl).toBe('https://github.com/PetarStoev02/talyx-app/releases/tag/v1.2.3')
  })

  it('should report the steps unavailable when the release file is over 64 KiB', async () => {
    const oversized = new Uint8Array(64 * 1024 + 1)
    stubFetch(oversized)

    // The hash matches and the platform is supported, so only the size cap can refuse it.
    const source = {
      ...installStepsSource(),
      expectedSha256: sha256(oversized),
      platform: 'darwin' as const
    }

    expect(await loadInstallSteps(source)).toEqual({
      kind: 'unavailable',
      releaseUrl: 'https://github.com/PetarStoev02/talyx-app/releases/tag/v1.2.3'
    })
  })
})
