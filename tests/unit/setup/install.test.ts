import { describe, expect, it, vi } from 'vitest'
import type { InstallExit, InstallSteps } from '../../../src/shared/setup'
import { useInstall, type SetupBackend } from '@features/setup/install'

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

  it('should ask the backend to cancel', async () => {
    const backend = fakeBackend()
    await useInstall.getState().cancel(backend)
    expect(backend.cancel).toHaveBeenCalledOnce()
  })
})
