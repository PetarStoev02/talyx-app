import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import pluginInit from '../../../../resources/engine-plugin/talyx-rooms/__init__.py?raw'
import pluginManifest from '../../../../resources/engine-plugin/talyx-rooms/plugin.yaml?raw'
import type { Engine } from './engine'

/** The engine plugin's name, as its manifest and its CLI command spell it. */
export const ROOMS_PLUGIN = 'talyx-rooms'
// The default profile's store, where the gateway keeps its rooms.
const ROOM_STORE = 'state.db'

export const PLUGIN_FILES: Record<string, string> = {
  '__init__.py': pluginInit,
  'plugin.yaml': pluginManifest
}

/** A room member as the engine stores it, the same shape `groups.create` takes. */
export interface RoomMemberRecord {
  member_id: string
  profile: string
  handle: string
  display_name: string
  target: { kind: 'local'; profile: string }
}

export interface MembersChange {
  added: string[]
  removed: string[]
  changed: boolean
}

export interface RoomMembersDeps {
  engine: Pick<Engine, 'cli'>
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, text: string) => Promise<void>
  mkdir: (path: string) => Promise<void>
}

/**
 * Changes the bots of an existing room in place, through Talyx's engine plugin: the engine has no
 * call for it, and a new room would lose the history. The plugin is written into the engine's
 * plugins folder and enabled the first time; an older copy is replaced.
 */
export function roomMembers(deps: RoomMembersDeps): {
  set: (roomId: string, members: RoomMemberRecord[]) => Promise<MembersChange>
} {
  let installed: Promise<string> | null = null

  async function install(): Promise<string> {
    // Any quick command: what is wanted is the home the attached engine reports.
    const { home } = await deps.engine.cli(['config', 'path'])
    const folder = join(home, 'plugins', ROOMS_PLUGIN)
    const stale = await Promise.all(
      Object.entries(PLUGIN_FILES).map(async ([name, text]) => {
        const current = await deps.readFile(join(folder, name)).catch(() => null)
        return current === text ? null : ([name, text] as const)
      })
    )
    const writes = stale.filter((entry) => entry !== null)
    if (writes.length > 0) {
      await deps.mkdir(folder)
      for (const [name, text] of writes) await deps.writeFile(join(folder, name), text)
    }
    const enabled = await deps.engine.cli(['plugins', 'enable', ROOMS_PLUGIN])
    if (enabled.code !== 0)
      throw new Error(`The rooms plugin was not enabled: ${lastLine(enabled)}`)
    return home
  }

  return {
    async set(roomId, members) {
      installed ??= install().catch((error: unknown) => {
        installed = null
        throw error
      })
      const home = await installed
      const result = await deps.engine.cli([
        ROOMS_PLUGIN,
        'members',
        '--db',
        join(home, ROOM_STORE),
        '--home',
        home,
        '--room',
        roomId,
        '--members',
        JSON.stringify(members)
      ])
      const answer = parseAnswer(result.stdout)
      if (result.code !== 0 || !answer?.ok)
        throw new Error(answer?.error ?? `The room's bots did not change: ${lastLine(result)}`)
      return { added: answer.added ?? [], removed: answer.removed ?? [], changed: !!answer.changed }
    }
  }
}

interface PluginAnswer {
  ok: boolean
  error?: string
  added?: string[]
  removed?: string[]
  changed?: boolean
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

function lastLine(result: { stdout: string; stderr: string }): string {
  return (result.stderr.trim() || result.stdout.trim()).split('\n').at(-1) ?? ''
}

export function nodeFileDeps(): Omit<RoomMembersDeps, 'engine'> {
  return {
    readFile: (path) => readFile(path, 'utf8'),
    writeFile: (path, text) => writeFile(path, text, 'utf8'),
    mkdir: async (path) => {
      await mkdir(path, { recursive: true })
    }
  }
}
