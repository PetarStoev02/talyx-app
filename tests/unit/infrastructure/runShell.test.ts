import { describe, it, expect } from 'vitest'
import { tmpdir } from 'os'
import { runShell } from '../../../src/main/infrastructure/agent/runShell'

const cwd = tmpdir()

describe('runShell', () => {
  it('should resolve with the exit code and the captured output', async () => {
    const result = await runShell('echo hi', cwd, new AbortController().signal)
    expect(result).toEqual({ exitCode: 0, output: 'hi\n', timedOut: false, aborted: false })
  })

  it('should settle as soon as the command outruns its timeout', async () => {
    const started = Date.now()
    const result = await runShell('sleep 5', cwd, new AbortController().signal, 100)
    expect(result.timedOut).toBe(true)
    expect(result.exitCode).toBeNull()
    expect(Date.now() - started).toBeLessThan(1000)
  })

  it('should settle as aborted when the signal is aborted', async () => {
    const controller = new AbortController()
    const started = Date.now()
    const pending = runShell('sleep 5', cwd, controller.signal)
    controller.abort()
    const result = await pending
    expect(result.aborted).toBe(true)
    expect(result.timedOut).toBe(false)
    expect(Date.now() - started).toBeLessThan(1000)
  })
})
