import { useEngine } from '../../../src/renderer/src/app/providers/useEngine'
import type { SetupBackend } from '../../../src/renderer/src/features/setup/install'
import { EXPECTED_ENGINE_VERSION, type EngineStatus } from '../../../src/shared/engine'
import type { InstallExit, InstallSteps } from '../../../src/shared/setup'

const MODES = ['missing', 'offline', 'mismatch', 'fail', 'old', 'windows'] as const
export type SetupMode = (typeof MODES)[number]

const LINE_MS = 300
const CHECK_MS = 600
const OLD_VERSION = '0.21.0'
const RELEASE_URL = 'https://example.com/releases/v1.0.0-fixture'
// Synthetic commands: they only name themselves, never a real installer.
const COMMANDS = [
  'echo Downloading the engine…',
  'echo Installing the engine…',
  'echo Linking talyx-engine…'
]
const OUTPUT = [
  ['Downloading the engine…', 'Fetched 3 of 3 parts.'],
  ['Installing the engine…', 'Unpacked 214 files.', 'Wrote the engine profile.'],
  ['Linking talyx-engine…', 'talyx-engine is on PATH.']
]
// What main reports on Windows, where Talyx cannot attach to the engine yet.
const WINDOWS_STATUS: EngineStatus = {
  state: 'error',
  message: 'Talyx cannot attach to the engine on Windows yet',
  version: null
}
// `fail` stops in the second command, as a failed download of a dependency would.
const FAILING = { index: 1, code: 1, line: 'error: the package index could not be reached' }

/** The `?setup=` mode in a page URL; null keeps the plain fixture. */
export function setupMode(search: string): SetupMode | null {
  const mode = new URLSearchParams(search).get('setup')
  return MODES.find((known) => known === mode) ?? null
}

/** An attached engine as the fixture's pages need it. */
export function attachedEngine(version: string): EngineStatus {
  return {
    state: 'attached',
    version,
    commit: null,
    home: '/fixture/engine',
    stale: false,
    botMetaKey: 'acme-bots',
    botGroupsMetaKey: 'acme-bots-groups',
    managerHandle: 'acme'
  }
}

/**
 * A scripted engine install for the setup flow: the engine status, Check and Choose file go through
 * `useEngine`, the install prints one output line every 300 ms. A finished install (or a chosen
 * file) makes the next check find engine 0.22.5.
 */
export function fixtureSetup(mode: SetupMode): SetupBackend {
  let installed = false
  let timer: ReturnType<typeof setTimeout> | null = null
  const outputs = new Set<(index: number, text: string) => void>()
  const exits = new Set<(exit: InstallExit) => void>()

  const found = (): EngineStatus => {
    if (installed) return attachedEngine(EXPECTED_ENGINE_VERSION)
    if (mode === 'old') return attachedEngine(OLD_VERSION)
    if (mode === 'windows') return WINDOWS_STATUS
    return { state: 'missing', enginePath: null }
  }
  const check = async (): Promise<void> => {
    useEngine.setState({ checking: true })
    await delay(CHECK_MS)
    useEngine.setState({ status: found(), checking: false })
  }
  useEngine.setState({
    status: found(),
    connection: 'open',
    everConnected: true,
    check,
    pickPath: () => {
      installed = true
      return check()
    }
  })

  const exit = (result: InstallExit): void => {
    timer = null
    if (result.kind === 'ok') installed = true
    for (const cb of exits) cb(result)
  }

  return {
    installSteps: async () => {
      await delay(CHECK_MS)
      return steps(mode)
    },
    run: async () => {
      if (timer) throw new Error('An install is already running')
      const lines = script(mode)
      const next = (at: number): void => {
        if (at === lines.length) return exit(mode === 'fail' ? failed() : { kind: 'ok' })
        const [index, text] = lines[at]
        for (const cb of outputs) cb(index, `${text}\n`)
        timer = setTimeout(() => next(at + 1), LINE_MS)
      }
      timer = setTimeout(() => next(0), LINE_MS)
    },
    cancel: async () => {
      if (!timer) return
      clearTimeout(timer)
      exit({ kind: 'cancelled' })
    },
    onOutput: (cb) => {
      outputs.add(cb)
      return () => outputs.delete(cb)
    },
    onExit: (cb) => {
      exits.add(cb)
      return () => exits.delete(cb)
    },
    recheckEngine: check
  }
}

function steps(mode: SetupMode): InstallSteps {
  if (mode === 'offline') return { kind: 'unavailable', releaseUrl: RELEASE_URL }
  if (mode === 'mismatch') return { kind: 'mismatch', releaseUrl: RELEASE_URL }
  if (mode === 'windows') return { kind: 'unsupported', releaseUrl: RELEASE_URL }
  return {
    kind: 'ready',
    commands: COMMANDS,
    engineVersion: EXPECTED_ENGINE_VERSION,
    releaseUrl: RELEASE_URL
  }
}

// Each output line with its command's index; `fail` ends on the failing command's error.
function script(mode: SetupMode): Array<[number, string]> {
  const lines = OUTPUT.flatMap((texts, index) =>
    texts.map((text): [number, string] => [index, text])
  )
  if (mode !== 'fail') return lines
  return [...lines.filter(([index]) => index <= FAILING.index), [FAILING.index, FAILING.line]]
}

function failed(): InstallExit {
  return { kind: 'failed', index: FAILING.index, code: FAILING.code }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
