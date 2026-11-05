import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { basename } from 'node:path'
import type { InstallExit } from '../../../shared/setup'

export type InstallOutputSink = (index: number, text: string) => void

export interface InstallRun {
  done: Promise<InstallExit>
  cancel: () => void
}

const KILL_GRACE_MS = 3000
// Shells that take `-lc` and run the POSIX syntax the install commands are written in; csh, fish
// and nushell do neither.
const POSIX_SHELLS = new Set(['bash', 'zsh', 'sh', 'dash', 'ksh'])

export function loginShell(): string {
  const shell = process.env.SHELL
  if (shell && POSIX_SHELLS.has(basename(shell))) return shell
  return existsSync('/bin/bash') ? '/bin/bash' : '/bin/sh'
}

export interface InstallRunOptions {
  /** The whole environment the commands see; nothing is inherited from this process. */
  env: Record<string, string>
  login: boolean
}

/** `options` null runs the commands in a login shell with this process's environment. */
export function runInstall(
  commands: string[],
  sink: InstallOutputSink,
  shell: string,
  options: InstallRunOptions | null
): InstallRun {
  let cancelled = false
  let current: ChildProcess | null = null

  async function runAll(): Promise<InstallExit> {
    for (const [index, command] of commands.entries()) {
      if (cancelled) return { kind: 'cancelled' }
      const code = await runOne(command, (text) => sink(index, text))
      if (cancelled) return { kind: 'cancelled' }
      if (code !== 0) return { kind: 'failed', index, code }
    }
    return { kind: 'ok' }
  }

  function runOne(command: string, emit: (text: string) => void): Promise<number> {
    return new Promise((resolve) => {
      // A login shell so the command sees the user's PATH; detached so the whole process group
      // can be killed on cancel; stdin closed so a command that prompts reads EOF instead of hanging.
      const child = spawn(shell, [options?.login === false ? '-c' : '-lc', command], {
        env: options?.env,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe']
      })
      current = child
      for (const stream of [child.stdout, child.stderr]) {
        // One decoder per stream so a character split across chunks stays whole.
        const decoder = new TextDecoder()
        stream.on('data', (chunk: Buffer) => emit(decoder.decode(chunk, { stream: true })))
        stream.on('end', () => {
          const rest = decoder.decode()
          if (rest) emit(rest)
        })
      }
      child.on('error', (err) => {
        emit(`${err.message}\n`)
        resolve(127)
      })
      // 'close', not 'exit': every output chunk has been read by then.
      child.on('close', (code) => {
        current = null
        resolve(code ?? 1)
      })
    })
  }

  function cancel(): void {
    cancelled = true
    const child = current
    if (!child?.pid) return
    killGroup(child.pid, 'SIGTERM')
    const timer = setTimeout(() => killGroup(child.pid!, 'SIGKILL'), KILL_GRACE_MS)
    timer.unref()
    child.once('close', () => clearTimeout(timer))
  }

  return { done: runAll(), cancel }
}

function killGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal)
  } catch {
    // The group is already gone.
  }
}
