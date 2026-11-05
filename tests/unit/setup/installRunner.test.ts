import { execFileSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'
import {
  loginShell,
  runInstall,
  type InstallRun
} from '../../../src/main/infrastructure/setup/installRunner'

const SH = '/bin/sh'
const CANCEL_SLEEP = 'sleep 31.7'

function collect(commands: string[]): { run: InstallRun; chunks: [number, string][] } {
  const chunks: [number, string][] = []
  const run = runInstall(commands, (index, text) => chunks.push([index, text]), SH)
  return { run, chunks }
}

function leftoverSleeps(): string[] {
  try {
    return execFileSync('pgrep', ['-f', CANCEL_SLEEP], { encoding: 'utf8' }).trim().split('\n')
  } catch {
    return []
  }
}

afterEach(() => {
  for (const pid of leftoverSleeps()) process.kill(Number(pid), 'SIGKILL')
})

describe('runInstall', () => {
  it('should run every command in order and stream their output', async () => {
    const { run, chunks } = collect(['echo one', 'echo two'])

    expect(await run.done).toEqual({ kind: 'ok' })
    expect(chunks).toEqual([
      [0, 'one\n'],
      [1, 'two\n']
    ])
  })

  it('should stop at the first command that fails', async () => {
    const { run, chunks } = collect(['echo a', 'exit 3', 'echo never'])

    expect(await run.done).toEqual({ kind: 'failed', index: 1, code: 3 })
    expect(chunks.some(([index]) => index === 2)).toBe(false)
  })

  it('should stream stderr too', async () => {
    const { run, chunks } = collect(['echo oops 1>&2'])

    await run.done
    expect(chunks).toEqual([[0, 'oops\n']])
  })

  it('should kill the whole command on cancel', async () => {
    const { run } = collect([`sh -c "${CANCEL_SLEEP}" & wait`])
    await new Promise((resolve) => setTimeout(resolve, 100))
    const started = Date.now()

    run.cancel()

    expect(await run.done).toEqual({ kind: 'cancelled' })
    expect(Date.now() - started).toBeLessThan(2000)
    expect(leftoverSleeps()).toEqual([])
  })

  it('should give a command no input', async () => {
    const { run, chunks } = collect(['read x; echo "got:$x"'])

    expect(await run.done).toEqual({ kind: 'ok' })
    expect(chunks.map(([, text]) => text).join('')).toBe('got:\n')
  })

  it('should keep a character split across chunks whole', async () => {
    const { run, chunks } = collect(['printf "\\321"; sleep 0.1; printf "\\221\\n"'])

    await run.done
    expect(chunks.map(([, text]) => text).join('')).toBe('ё\n')
  })
})

describe('loginShell', () => {
  it('should return an absolute shell path', () => {
    expect(loginShell()).toMatch(/^\//)
  })
})
