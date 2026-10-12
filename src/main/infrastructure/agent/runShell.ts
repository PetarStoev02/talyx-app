import { spawn } from 'child_process'
import { RUN_TIMEOUT_MS } from '../../domain/instruction/capabilities/dev'

export interface ShellResult {
  exitCode: number | null
  output: string
  timedOut: boolean
  aborted: boolean
}

/**
 * Settles exactly once: the timeout resolves straight away rather than waiting
 * for a 'close' that a SIGKILLed shell may never deliver.
 */
export function runShell(
  command: string,
  cwd: string,
  signal: AbortSignal,
  timeoutMs: number = RUN_TIMEOUT_MS
): Promise<ShellResult> {
  return new Promise((resolve) => {
    let settled = false
    function settle(result: ShellResult): void {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(result)
    }

    const child = spawn(command, { cwd, shell: true, signal })
    let output = ''
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      settle({ exitCode: null, output, timedOut: true, aborted: false })
    }, timeoutMs)

    child.stdout.on('data', (d: Buffer) => (output += d.toString()))
    child.stderr.on('data', (d: Buffer) => (output += d.toString()))
    child.on('error', (err) => {
      if (err.name === 'AbortError' || signal.aborted)
        settle({ exitCode: null, output, timedOut: false, aborted: true })
      else settle({ exitCode: null, output: output + err.message, timedOut: false, aborted: false })
    })
    child.on('close', (code) =>
      settle({ exitCode: code, output, timedOut: false, aborted: signal.aborted })
    )
  })
}
