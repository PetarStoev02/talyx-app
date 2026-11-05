import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { InstallExit, InstallSteps } from '../../../src/shared/setup'

type Handler = (event: unknown, ...args: unknown[]) => unknown

const handlers = new Map<string, Handler>()
const setup = vi.hoisted(() => ({
  loadInstallSteps: vi.fn(),
  runInstall: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: { handle: (channel: string, fn: Handler) => handlers.set(channel, fn) }
}))
const logger = vi.hoisted(() => ({ warn: vi.fn(), info: vi.fn() }))
vi.mock('electron-log', () => ({ default: logger }))
vi.mock('../../../src/main/infrastructure/setup/installSteps', () => ({
  loadInstallSteps: setup.loadInstallSteps,
  installStepsSource: () => ({})
}))
vi.mock('../../../src/main/infrastructure/setup/installRunner', () => ({
  runInstall: setup.runInstall,
  loginShell: () => '/bin/sh'
}))

// The module keeps the loaded steps and the running install, so each test gets a fresh copy.
let cancelInstall: () => void

const READY: InstallSteps = {
  kind: 'ready',
  commands: ['one', 'two'],
  engineVersion: '1.2.3',
  releaseUrl: 'https://example.com/r'
}

interface Page {
  sender: {
    send: ReturnType<typeof vi.fn>
    isDestroyed: () => boolean
    on: (event: string, listener: () => void) => void
  }
  fire: (event: string) => void
  destroy: () => void
}

function page(): Page {
  const listeners = new Map<string, () => void>()
  let destroyed = false
  return {
    sender: {
      send: vi.fn(),
      isDestroyed: () => destroyed,
      on: (event, listener) => listeners.set(event, listener)
    },
    fire: (event) => listeners.get(event)?.(),
    destroy: () => {
      destroyed = true
    }
  }
}

const invoke = (channel: string, event: unknown, ...args: unknown[]): unknown =>
  handlers.get(channel)!(event, ...args)

/** A run the test finishes by hand. */
function controlledRun(): {
  finish: (exit: InstallExit) => Promise<void>
  cancel: ReturnType<typeof vi.fn>
  sink: () => (index: number, text: string) => void
} {
  let resolve!: (exit: InstallExit) => void
  const done = new Promise<InstallExit>((r) => (resolve = r))
  const cancel = vi.fn()
  setup.runInstall.mockImplementationOnce(() => ({ done, cancel }))
  return {
    cancel,
    finish: async (exit) => {
      resolve(exit)
      await done
      await Promise.resolve()
    },
    sink: () => setup.runInstall.mock.calls.at(-1)![1]
  }
}

async function startRun(owner: Page): Promise<ReturnType<typeof controlledRun>> {
  const run = controlledRun()
  await invoke('setup:install-steps', owner)
  await invoke('setup:install-run', owner)
  return run
}

describe('setup IPC', () => {
  beforeEach(async () => {
    handlers.clear()
    vi.clearAllMocks()
    vi.resetModules()
    setup.loadInstallSteps.mockResolvedValue(READY)
    const ipc = await import('../../../src/main/infrastructure/ipc/setup.ipc')
    cancelInstall = ipc.cancelInstall
    ipc.registerSetupIpc()
  })

  it('should return the steps main loaded', async () => {
    expect(await invoke('setup:install-steps', page())).toEqual(READY)
  })

  it('should run only the steps main loaded', async () => {
    const owner = page()
    expect(() => invoke('setup:install-run', owner)).toThrow('Load the install steps first')
    expect(setup.runInstall).not.toHaveBeenCalled()

    controlledRun()
    await invoke('setup:install-steps', owner)
    await invoke('setup:install-run', owner)
    expect(setup.runInstall).toHaveBeenCalledWith(['one', 'two'], expect.any(Function), '/bin/sh')
  })

  it('should not run steps that were not ready', async () => {
    setup.loadInstallSteps.mockResolvedValue({ kind: 'mismatch', releaseUrl: 'https://x' })
    await invoke('setup:install-steps', page())
    expect(() => invoke('setup:install-run', page())).toThrow('Load the install steps first')
  })

  it('should refuse a second run while one is running', async () => {
    const owner = page()
    const run = await startRun(owner)
    expect(() => invoke('setup:install-run', owner)).toThrow('An install is already running')
    await run.finish({ kind: 'ok' })
    controlledRun()
    await expect(Promise.resolve(invoke('setup:install-run', owner))).resolves.toBeUndefined()
  })

  it('should send output and the exit to the page that started the run', async () => {
    const owner = page()
    const other = page()
    const run = await startRun(owner)
    run.sink()(1, 'hello')
    await run.finish({ kind: 'failed', index: 1, code: 2 })

    expect(owner.sender.send).toHaveBeenCalledWith('setup:install-output', 1, 'hello')
    expect(owner.sender.send).toHaveBeenCalledWith('setup:install-exit', {
      kind: 'failed',
      index: 1,
      code: 2
    })
    expect(other.sender.send).not.toHaveBeenCalled()
  })

  it.each([
    ['ok', { kind: 'ok' }, 'info', '[Setup] Install finished'],
    ['cancelled', { kind: 'cancelled' }, 'info', '[Setup] Install cancelled'],
    [
      'failed',
      { kind: 'failed', index: 1, code: 2 },
      'warn',
      '[Setup] Install command 1 failed with exit 2'
    ]
  ] as const)(
    'should log the %s exit without commands or output',
    async (_k, exit, level, line) => {
      const owner = page()
      const run = await startRun(owner)
      run.sink()(0, 'secret output')
      await run.finish(exit)

      expect(logger[level]).toHaveBeenCalledWith(line)
      const logged = JSON.stringify([...logger.info.mock.calls, ...logger.warn.mock.calls])
      for (const text of ['one', 'two', 'secret output']) expect(logged).not.toContain(text)
    }
  )

  it('should log an unexpected failure by name and code only, never its message', async () => {
    const owner = page()
    const error = Object.assign(new Error('spawn /bin/sh -lc one ENOENT'), { code: 'ENOENT' })
    setup.runInstall.mockImplementationOnce(() => ({
      done: Promise.reject(error),
      cancel: vi.fn()
    }))
    await invoke('setup:install-steps', owner)
    await invoke('setup:install-run', owner)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(logger.warn).toHaveBeenCalledWith(
      '[Setup] The install run failed unexpectedly (Error ENOENT)'
    )
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('one')
    expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining('command 0'))
    expect(owner.sender.send).toHaveBeenCalledWith('setup:install-exit', {
      kind: 'failed',
      index: 0,
      code: 1
    })
  })

  it('should not throw when the page is gone or refuses a send', async () => {
    const owner = page()
    const run = await startRun(owner)
    owner.sender.send.mockImplementation(() => {
      throw new Error('Render frame was disposed')
    })
    expect(() => run.sink()(0, 'x')).not.toThrow()
    owner.destroy()
    expect(() => run.sink()(0, 'y')).not.toThrow()
    await run.finish({ kind: 'ok' })
  })

  it.each(['destroyed', 'did-navigate'])(
    'should cancel the run when the page fires %s',
    async (event) => {
      const owner = page()
      const run = await startRun(owner)
      owner.fire(event)
      expect(run.cancel).toHaveBeenCalledTimes(1)
    }
  )

  it('should cancel only for the page that started the run', async () => {
    const owner = page()
    const other = page()
    const run = await startRun(owner)
    await invoke('setup:install-steps', other)
    invoke('setup:install-cancel', other)
    other.fire('destroyed')
    expect(run.cancel).not.toHaveBeenCalled()
    invoke('setup:install-cancel', owner)
    expect(run.cancel).toHaveBeenCalledTimes(1)
  })

  it('should cancel a running install on quit and do nothing when idle', async () => {
    expect(() => cancelInstall()).not.toThrow()
    const run = await startRun(page())
    cancelInstall()
    expect(run.cancel).toHaveBeenCalledTimes(1)
  })
})
