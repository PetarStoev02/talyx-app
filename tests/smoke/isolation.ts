import { execFile } from 'node:child_process'
import { mkdtempSync, realpathSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { userBinEngine } from '../../src/main/infrastructure/engine/engine'
import type { CliResult } from '../../src/main/infrastructure/engine/gateway'

// The gateway's own ensure deadline plus start-up, as the app's runEngineCli allows.
const CLI_TIMEOUT_MS = 75_000
const CLI_MAX_OUTPUT = 1024 * 1024

/** A fresh, short temp dir spelled as its real path (macOS /tmp is /private/tmp; control socket
 *  paths are limited to ~104 characters). */
export function makeTempHome(): string {
  return realpathSync(mkdtempSync('/tmp/ts-'))
}

/** The whole environment an isolated engine sees: nothing is inherited from this process. */
export function isolatedEnv(home: string): Record<string, string> {
  return {
    HOME: home,
    PATH: `${home}/.local/bin:/usr/bin:/bin:/usr/sbin:/sbin`,
    TMPDIR: home,
    LANG: 'en_US.UTF-8'
  }
}

/** The engine's runner for the smoke test: only the temp home's engine, only the isolated env.
 *  Any other command (a bare name, a PATH or real-home engine) is refused, not reported missing,
 *  so the engine resolver cannot fall back to the user's real engine. */
export function isolatedRun(home: string): (command: string, args: string[]) => Promise<CliResult> {
  const engine = userBinEngine(process.platform, home)
  return async (command, args) => {
    if (command !== engine) throw new Error(`Smoke: refused ${command}`)
    return new Promise((resolvePromise, reject) => {
      execFile(
        command,
        args,
        { env: isolatedEnv(home), timeout: CLI_TIMEOUT_MS, maxBuffer: CLI_MAX_OUTPUT },
        (error, stdout, stderr) => {
          // A number is the exit code; anything else (ENOENT, a timeout kill) is a failure to run.
          if (error && typeof error.code !== 'number') return reject(error)
          resolvePromise({ code: error ? Number(error.code) : 0, stdout, stderr })
        }
      )
    })
  }
}

/** Whether `path` resolves inside `home`, symlinks followed wherever the path exists. */
export function insideHome(home: string, path: string): boolean {
  const rel = relative(realpathOfExisting(resolve(home)), realpathOfExisting(resolve(path)))
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
}

// realpath of the deepest existing ancestor, with the missing tail appended as spelled.
function realpathOfExisting(path: string): string {
  try {
    return realpathSync(path)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code !== 'ENOENT' && code !== 'ENOTDIR') throw error
    const parent = dirname(path)
    return parent === path ? path : join(realpathOfExisting(parent), basename(path))
  }
}
