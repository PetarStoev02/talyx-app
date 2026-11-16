import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Engine } from './engine'

/** What a Talyx engine plugin needs: the engine's CLI and home, and its plugins folder on disk. */
export interface EnginePluginDeps {
  engine: Pick<Engine, 'cli' | 'home'>
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, text: string) => Promise<void>
  mkdir: (path: string) => Promise<void>
}

/** A plugin's last line: `ok`, the plugin's own reason when not, and whatever else it answers. */
export interface PluginAnswer {
  ok: boolean
  error?: string
  [field: string]: unknown
}

export interface PluginRun {
  code: number
  /** What the engine printed last when the plugin gave no answer. */
  printed: string
  answer: PluginAnswer | null
}

/**
 * Runs one of Talyx's engine plugins as an engine CLI command. The plugin is written into the
 * engine's plugins folder and enabled the first time; an older copy is replaced.
 */
export function enginePlugin(
  deps: EnginePluginDeps,
  plugin: { name: string; files: Record<string, string> }
): { run: (args: (home: string) => string[]) => Promise<PluginRun> } {
  // The install for the home it was last checked in; another engine (Settings → choose file)
  // checks again. Runs that start together share one install: the engine refuses a second
  // enable while the first is changing its plugin list.
  let installed: { home: string; done: Promise<void> } | null = null

  async function install(home: string): Promise<void> {
    const folder = join(home, 'plugins', plugin.name)
    const stale = await Promise.all(
      Object.entries(plugin.files).map(async ([name, text]) => {
        // A file that is not there yet counts as out of date.
        const current = await deps.readFile(join(folder, name)).catch(() => null)
        return current === text ? null : ([name, text] as const)
      })
    )
    const writes = stale.filter((entry) => entry !== null)
    if (writes.length > 0) {
      await deps.mkdir(folder)
      for (const [name, text] of writes) await deps.writeFile(join(folder, name), text)
    }
    const enabled = await deps.engine.cli(['plugins', 'enable', plugin.name])
    if (enabled.code !== 0)
      throw new Error(`The ${plugin.name} plugin was not enabled: ${lastLine(enabled)}`)
  }

  return {
    async run(args) {
      const home = await deps.engine.home()
      if (installed?.home !== home) {
        const done = install(home)
        installed = { home, done }
        // A failed install is tried again by the next run.
        done.catch(() => {
          if (installed?.done === done) installed = null
        })
      }
      await installed.done
      const result = await deps.engine.cli([plugin.name, ...args(home)])
      return { code: result.code, printed: lastLine(result), answer: parseAnswer(result.stdout) }
    }
  }
}

export function nodeFileDeps(): Omit<EnginePluginDeps, 'engine'> {
  return {
    readFile: (path) => readFile(path, 'utf8'),
    writeFile: (path, text) => writeFile(path, text, 'utf8'),
    mkdir: async (path) => {
      await mkdir(path, { recursive: true })
    }
  }
}

// The plugin prints one JSON line last; the engine may print notices before it.
function parseAnswer(stdout: string): PluginAnswer | null {
  const line = stdout.trim().split('\n').at(-1) ?? ''
  try {
    const value = JSON.parse(line) as unknown
    return value && typeof value === 'object' && 'ok' in value ? (value as PluginAnswer) : null
  } catch {
    return null
  }
}

/** What the engine printed last: its error line when it wrote one, else its last output line. */
export function lastLine(result: { stdout: string; stderr: string }): string {
  return (result.stderr.trim() || result.stdout.trim()).split('\n').at(-1) ?? ''
}
