import { afterEach, describe, expect, it, vi } from 'vitest'

describe('engine IPC socket', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('should close the main socket that finishes opening after the page gave up on it', async () => {
    let finishOpen!: () => void
    const api = {
      openEngineSocket: vi.fn(() => new Promise<void>((resolve) => (finishOpen = resolve))),
      closeEngineSocket: vi.fn(async () => undefined),
      sendEngineSocket: vi.fn(async () => undefined),
      onEngineSocketFrame: () => () => undefined,
      onEngineSocketClosed: () => () => undefined
    }
    vi.stubGlobal('window', { api })
    const { EngineIpcSocket } = await import('@shared/engine/socket')
    const socket = new EngineIpcSocket('default')
    const opened = vi.fn()
    socket.addEventListener('open', opened)

    // The client's connect timeout fires while main is still minting the ticket.
    socket.close()
    finishOpen()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(opened).not.toHaveBeenCalled()
    expect(api.closeEngineSocket).toHaveBeenLastCalledWith(socket.id)
    expect(api.closeEngineSocket).toHaveBeenCalledTimes(2)
  })

  it('should not raise when a send reaches a socket main already closed', async () => {
    const api = {
      openEngineSocket: vi.fn(async () => undefined),
      closeEngineSocket: vi.fn(async () => undefined),
      sendEngineSocket: vi.fn(async () => {
        throw new Error('Engine socket is not open')
      }),
      onEngineSocketFrame: () => () => undefined,
      onEngineSocketClosed: () => () => undefined
    }
    vi.stubGlobal('window', { api })
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    const { EngineIpcSocket } = await import('@shared/engine/socket')
    new EngineIpcSocket('default').send('{}')
    await new Promise((resolve) => setTimeout(resolve, 10))
    process.off('unhandledRejection', unhandled)
    expect(unhandled).not.toHaveBeenCalled()
  })
})
