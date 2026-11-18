import { join } from 'node:path'
import pluginInit from '../../../../resources/engine-plugin/talyx-rooms/__init__.py?raw'
import pluginManifest from '../../../../resources/engine-plugin/talyx-rooms/plugin.yaml?raw'
import type { MembersChange } from '@contract/engine'
import { enginePlugin, type EnginePluginDeps, type PluginAnswer } from './enginePlugin'

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

/**
 * Changes the bots of an existing room in place, through Talyx's engine plugin: the engine has no
 * call for it, and a new room would lose the history.
 */
export function roomMembers(deps: EnginePluginDeps): {
  set: (roomId: string, members: RoomMemberRecord[]) => Promise<MembersChange>
} {
  const plugin = enginePlugin(deps, { name: ROOMS_PLUGIN, files: PLUGIN_FILES })
  return {
    async set(roomId, members) {
      const { code, printed, answer } = await plugin.run((home) => [
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
      if (code !== 0 || !answer?.ok)
        throw new Error(answer?.error ?? `The room's bots did not change: ${printed}`)
      const change = answer as PluginAnswer & Partial<MembersChange>
      return { added: change.added ?? [], removed: change.removed ?? [], changed: !!change.changed }
    }
  }
}
