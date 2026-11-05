import { describe, expect, it, vi } from 'vitest'
import type { InstallExit, InstallSteps } from '../../../src/shared/setup'
import { displayOutput, useInstall, type SetupBackend } from '@features/setup/install'

const ready: InstallSteps = {
  kind: 'ready',
  commands: ['one', 'two'],
  engineVersion: '0.22.5',
  releaseUrl: 'https://example.test/release'
}

function fakeBackend(): SetupBackend & {
  emit: (index: number, text: string) => void
  finish: (exit: InstallExit) => void
  outputListeners: number
} {
  const outputs = new Set<(index: number, text: string) => void>()
  const exits = new Set<(exit: InstallExit) => void>()
  return {
    installSteps: vi.fn().mockResolvedValue(ready),
    run: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
    onOutput: (cb) => {
      outputs.add(cb)
      return () => outputs.delete(cb)
    },
    onExit: (cb) => {
      exits.add(cb)
      return () => exits.delete(cb)
    },
    recheckEngine: vi.fn().mockResolvedValue(undefined),
    emit: (index, text) => outputs.forEach((cb) => cb(index, text)),
    finish: (exit) => exits.forEach((cb) => cb(exit)),
    get outputListeners() {
      return outputs.size
    }
  }
}

describe('useInstall', () => {
  it('should load the steps from the backend', async () => {
    const backend = fakeBackend()
    await useInstall.getState().loadSteps(backend)
    expect(useInstall.getState().steps).toEqual(ready)
  })

  it('should append output chunks in order while running', async () => {
    const backend = fakeBackend()
    await useInstall.getState().start(backend)
    backend.emit(0, 'a')
    backend.emit(1, 'b')
    expect(useInstall.getState().running).toBe(true)
    expect(useInstall.getState().output).toBe('ab')
  })

  it('should stop running on exit and keep the output', async () => {
    const backend = fakeBackend()
    await useInstall.getState().start(backend)
    backend.emit(0, 'boom')
    backend.finish({ kind: 'failed', index: 0, code: 1 })
    const state = useInstall.getState()
    expect(state.running).toBe(false)
    expect(state.output).toBe('boom')
    expect(state.exit).toEqual({ kind: 'failed', index: 0, code: 1 })
  })

  it('should clear the old output and exit when started again', async () => {
    const backend = fakeBackend()
    await useInstall.getState().start(backend)
    backend.emit(0, 'old')
    backend.finish({ kind: 'cancelled' })
    await useInstall.getState().start(backend)
    expect(useInstall.getState().output).toBe('')
    expect(useInstall.getState().exit).toBeNull()
    expect(useInstall.getState().running).toBe(true)
  })

  it('should subscribe to the backend once however often it starts', async () => {
    const backend = fakeBackend()
    await useInstall.getState().start(backend)
    await useInstall.getState().start(backend)
    expect(backend.outputListeners).toBe(1)
    backend.emit(0, 'x')
    expect(useInstall.getState().output).toBe('x')
  })

  it('should stop running when the backend refuses to start', async () => {
    const backend = fakeBackend()
    vi.mocked(backend.run).mockRejectedValue(new Error('busy'))
    await expect(useInstall.getState().start(backend)).rejects.toThrow('busy')
    expect(useInstall.getState().running).toBe(false)
  })

  it('should keep only the last 200,000 characters of a long output', async () => {
    const backend = fakeBackend()
    await useInstall.getState().start(backend)
    backend.emit(0, 'a'.repeat(150_000))
    backend.emit(0, 'b'.repeat(150_000))

    const { output } = useInstall.getState()
    expect(output).toHaveLength(200_000)
    expect(output.endsWith('b'.repeat(150_000))).toBe(true)
  })

  it.each([
    ['ok', { kind: 'ok' }, 1],
    ['failed', { kind: 'failed', index: 0, code: 1 }, 0],
    ['cancelled', { kind: 'cancelled' }, 0]
  ] as const)(
    'should look for the engine again only when the install ends ok (%s)',
    async (_kind, exit, checks) => {
      const backend = fakeBackend()
      await useInstall.getState().start(backend)

      backend.finish(exit)

      expect(backend.recheckEngine).toHaveBeenCalledTimes(checks)
    }
  )

  it('should ask the backend to cancel', async () => {
    const backend = fakeBackend()
    await useInstall.getState().cancel(backend)
    expect(backend.cancel).toHaveBeenCalledOnce()
  })
})

describe('displayOutput', () => {
  it('should leave plain output as it is', () => {
    expect(displayOutput('one\ntwo\n')).toBe('one\ntwo\n')
  })

  it('should drop colour and cursor escapes', () => {
    expect(displayOutput('\x1b[1;32mok\x1b[0m done\x1b[?25l\x1b[2K')).toBe('ok done')
  })

  it('should show only the last state of a line redrawn with a carriage return', () => {
    expect(displayOutput('10%\r50%\r100%\nnext\n')).toBe('100%\nnext\n')
  })

  it('should keep a line that ends in a carriage return before its newline', () => {
    expect(displayOutput('line one\r\nline two\r\n')).toBe('line one\nline two\n')
  })

  it('should show a redraw still in progress at its latest state', () => {
    expect(displayOutput('Fetching 1/3\rFetching 2/3')).toBe('Fetching 2/3')
  })
})
