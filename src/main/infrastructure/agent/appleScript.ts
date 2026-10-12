import { execFile } from 'child_process'

export type ExecFileFn = typeof execFile

const JXA_TIMEOUT_MS = 15_000
/** osascript wraps whatever the script threw in its own prefixes. */
const OSASCRIPT_PREFIX = /^(execution error:\s*)?(Error:\s*)*/

/**
 * Runs a JavaScript-for-Automation snippet through osascript and returns the
 * JSON it printed. The user's own apps (Calendar, Reminders, Notes) answer; the
 * first call makes macOS ask them for Automation permission for Talyx.
 */
export function runJxa<T>(
  source: string,
  args: string[],
  exec: ExecFileFn = execFile,
  signal?: AbortSignal
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    exec(
      'osascript',
      // `--` ends osascript's options: without it a first argument starting with
      // -e (a recipient name the model was tricked into) runs as more script.
      ['-l', 'JavaScript', '-e', source, '--', ...args],
      { timeout: JXA_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024, signal },
      (error, stdout) => {
        if (error) {
          const stderr = (error as { stderr?: unknown }).stderr
          const detail =
            typeof stderr === 'string' && stderr.trim().length > 0 ? stderr.trim() : error.message
          return reject(new Error(detail.replace(OSASCRIPT_PREFIX, '')))
        }
        try {
          resolve(JSON.parse(String(stdout)) as T)
        } catch {
          reject(new Error(`osascript output was not JSON: ${String(stdout).slice(0, 120)}`))
        }
      }
    )
  })
}
