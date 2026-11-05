import { describe, expect, it } from 'vitest'
import type { EngineStatus } from '../../../src/shared/engine'
import type { InstallSteps } from '../../../src/shared/setup'
import {
  engineScreen,
  restartCommand,
  watchRun,
  type EngineScreenFacts
} from '@features/setup/engineScreen'

const releaseUrl = 'https://example.test/releases/tag/v1.0.0'
const missing: EngineStatus = { state: 'missing', enginePath: null }
const ready: InstallSteps = {
  kind: 'ready',
  commands: ['echo one', 'echo two'],
  engineVersion: '0.22.7',
  releaseUrl
}

function attached(version: string, stale = false): EngineStatus {
  return {
    state: 'attached',
    version,
    commit: null,
    home: 'default',
    path: '/usr/local/bin/talyx-engine',
    stale,
    botMetaKey: 'k',
    botGroupsMetaKey: 'g',
    managerHandle: 'talyx'
  }
}

function errored(version: string | null, reason: 'protocol' | null = null): EngineStatus {
  return { state: 'error', message: 'no socket', version, reason }
}

function facts(overrides: Partial<EngineScreenFacts>): EngineScreenFacts {
  return {
    status: missing,
    checking: false,
    wantsInstall: false,
    steps: null,
    running: false,
    exit: null,
    ...overrides
  }
}

describe('engineScreen', () => {
  describe('looking for the engine', () => {
    it('should wait while the status is unknown or being checked', () => {
      expect(engineScreen(facts({ status: null })).kind).toBe('checking')
      expect(engineScreen(facts({ checking: true })).kind).toBe('checking')
    })

    it('should show a current engine as ready', () => {
      expect(engineScreen(facts({ status: attached('0.22.7') }))).toEqual({
        kind: 'ready',
        version: '0.22.7',
        path: '/usr/local/bin/talyx-engine',
        newer: false,
        stale: false
      })
    })

    it('should note a newer engine and a stale gateway', () => {
      expect(engineScreen(facts({ status: attached('0.23.0', true) }))).toEqual({
        kind: 'ready',
        version: '0.23.0',
        path: '/usr/local/bin/talyx-engine',
        newer: true,
        stale: true
      })
    })

    it('should offer the update to an older engine, attached or not', () => {
      expect(engineScreen(facts({ status: attached('0.21.0') }))).toEqual({
        kind: 'older',
        version: '0.21.0',
        attached: true
      })
      expect(engineScreen(facts({ status: errored('0.21.0') }))).toEqual({
        kind: 'older',
        version: '0.21.0',
        attached: false
      })
    })

    it('should show the attach error for a current or unknown version', () => {
      expect(engineScreen(facts({ status: errored('0.22.7') }))).toEqual({
        kind: 'attachError',
        message: 'no socket'
      })
      expect(engineScreen(facts({ status: errored(null) })).kind).toBe('attachError')
    })
  })

  describe('a protocol mismatch', () => {
    it('should still offer the update to an older engine', () => {
      expect(engineScreen(facts({ status: errored('0.21.0', 'protocol') }))).toEqual({
        kind: 'older',
        version: '0.21.0',
        attached: false
      })
    })

    it.each([
      ['0.23.0', 'newer'],
      ['0.22.7', 'same'],
      [null, 'same']
    ] as const)('should show the protocol screen for engine %s (%s)', (version, fit) => {
      expect(engineScreen(facts({ status: errored(version, 'protocol') }))).toEqual({
        kind: 'protocol',
        fit
      })
    })
  })

  describe('getting the install steps', () => {
    it('should fetch the steps for a missing engine', () => {
      expect(engineScreen(facts({})).kind).toBe('fetching')
    })

    it('should fetch the steps when asked to install over a found engine', () => {
      expect(engineScreen(facts({ status: errored(null), wantsInstall: true })).kind).toBe(
        'fetching'
      )
    })

    it('should show verified commands', () => {
      expect(engineScreen(facts({ steps: ready }))).toEqual({ kind: 'commands', steps: ready })
    })

    it.each([
      ['unavailable', 'unavailable'],
      ['invalid', 'unavailable'],
      ['mismatch', 'mismatch']
    ] as const)('should say why %s steps could not load', (kind, reason) => {
      expect(engineScreen(facts({ steps: { kind, releaseUrl } }))).toEqual({
        kind: 'stepsFailed',
        reason,
        releaseUrl
      })
    })

    it('should say the platform is not supported', () => {
      expect(engineScreen(facts({ steps: { kind: 'unsupported', releaseUrl } }))).toEqual({
        kind: 'unsupported',
        releaseUrl
      })
    })
  })

  describe('installing', () => {
    it('should show the live output while running', () => {
      expect(engineScreen(facts({ steps: ready, running: true })).kind).toBe('running')
    })

    it('should say which command stopped the install', () => {
      const exit = { kind: 'failed', index: 1, code: 22 } as const
      expect(engineScreen(facts({ steps: ready, exit }))).toEqual({
        kind: 'stopped',
        index: 1,
        code: 22
      })
    })

    it('should return to the commands after a cancel', () => {
      const exit = { kind: 'cancelled' } as const
      expect(engineScreen(facts({ steps: ready, exit })).kind).toBe('commands')
    })

    it('should judge a finished install by the check that follows it', () => {
      const exit = { kind: 'ok' } as const
      expect(engineScreen(facts({ steps: ready, exit, checking: true })).kind).toBe('checking')
      expect(engineScreen(facts({ steps: ready, exit })).kind).toBe('notFound')
      expect(
        engineScreen(facts({ steps: ready, exit, wantsInstall: true, status: attached('0.22.7') }))
          .kind
      ).toBe('ready')
    })

    it('should name the engine that still runs when the install left it older', () => {
      const exit = { kind: 'ok' } as const
      expect(engineScreen(facts({ steps: ready, exit, status: attached('0.21.0') }))).toEqual({
        kind: 'still-older',
        path: '/usr/local/bin/talyx-engine',
        version: '0.21.0'
      })
    })

    it('should still offer the update to an older engine that cannot attach after the install', () => {
      const exit = { kind: 'ok' } as const
      expect(engineScreen(facts({ steps: ready, exit, status: errored('0.21.0') })).kind).toBe(
        'older'
      )
    })
  })
})

describe('restartCommand', () => {
  it('should quote the engine path for the shell', () => {
    expect(restartCommand('/Users/a b/.local/bin/talyx-engine')).toBe(
      "'/Users/a b/.local/bin/talyx-engine' gateway restart"
    )
  })

  it('should keep a single quote in the path inside the quoting', () => {
    expect(restartCommand("/Users/o'neil/bin/talyx-engine")).toBe(
      "'/Users/o'\\''neil/bin/talyx-engine' gateway restart"
    )
  })
})

describe('watchRun', () => {
  const cancelled = { kind: 'cancelled' } as const

  it('should report a cancel of a run the screen saw, once', () => {
    const seen = watchRun(false, true, null)
    expect(seen).toEqual({ sawRun: true, cancelled: false })
    const ended = watchRun(seen.sawRun, false, cancelled)
    expect(ended).toEqual({ sawRun: false, cancelled: true })
    expect(watchRun(ended.sawRun, false, cancelled).cancelled).toBe(false)
  })

  it('should not report a cancel left from an earlier visit', () => {
    expect(watchRun(false, false, cancelled).cancelled).toBe(false)
  })

  it('should not report a run that ended another way', () => {
    expect(watchRun(true, false, { kind: 'ok' }).cancelled).toBe(false)
    expect(watchRun(true, false, { kind: 'failed', index: 0, code: 1 }).cancelled).toBe(false)
  })
})
