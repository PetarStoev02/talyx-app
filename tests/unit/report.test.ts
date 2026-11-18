import { afterEach, describe, expect, it, vi } from 'vitest'
import { reportError } from '../../src/renderer/src/shared/lib/report'

describe('reportError', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('should never report a failed log write again', async () => {
    // A plain function, not vi.fn: a mock handles the promises it returns, which would hide an
    // unhandled rejection.
    let writes = 0
    const logError = (): Promise<void> => {
      writes += 1
      return Promise.reject(new Error('Main is gone'))
    }
    vi.stubGlobal('window', { api: { logError } })
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)

    reportError('chat', new Error('Send failed'))
    await new Promise((resolve) => setTimeout(resolve, 10))
    process.off('unhandledRejection', unhandled)

    expect(writes).toBe(1)
    expect(logged).toHaveBeenCalledTimes(1)
    expect(unhandled).not.toHaveBeenCalled()
  })

  it('should write to the console only where there is no window', () => {
    vi.stubGlobal('window', undefined)
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(() => reportError('worker', 'Stopped')).not.toThrow()
    expect(logged).toHaveBeenCalledWith('[worker]', 'Stopped')
  })
})
