import { readRoster, saveBotMeta, saveFolders, saveRoomFolders } from './data'
import type { RosterBackend } from './data'
import { moveFolder, pinnedBots, problemOf, reorder } from './roster'
import type { RosterProblem } from './roster'
import { useRoster } from './store'
import type { Bot, Folder, RosterSnapshot } from './types'

export interface RosterActions {
  pin: (bot: Bot) => Promise<void>
  moveBot: (bot: Bot, folderId: string | null) => Promise<void>
  moveRoom: (roomId: string, folderId: string | null) => Promise<void>
  nest: (id: string, parentId: string | null) => Promise<void>
  orderFolder: (id: string, direction: number) => Promise<void>
  orderPin: (from: string, to: string) => Promise<void>
  addFolder: (name: string) => Promise<void>
  hide: (bot: Bot) => Promise<void>
  deleteProfile: (bot: Bot) => Promise<void>
}

export async function refreshRoster(backend: RosterBackend): Promise<void> {
  applySnapshot(await readRoster(backend))
}

// A bot hidden or deleted on another client must not stay selected.
export function applySnapshot(snapshot: RosterSnapshot): void {
  const { selection } = useRoster.getState()
  const exists =
    selection?.kind === 'bot'
      ? snapshot.bots.some((bot) => bot.name === selection.id && !bot.meta.hidden)
      : snapshot.rooms.some((room) => room.room_id === selection?.id)
  useRoster.setState({
    snapshot,
    loading: false,
    error: null,
    ...(selection && !exists ? { selection: null } : {})
  })
}

export function rosterActions(backend: RosterBackend): RosterActions {
  const snapshot = (): RosterSnapshot => useRoster.getState().snapshot
  const saveLayout = (update: (value: Folder[]) => Folder[]): Promise<void> =>
    saveFolders(backend, update, snapshot().folders)
  return {
    pin: (bot) =>
      saveBotMeta(
        backend,
        bot.name,
        bot.meta.pinned
          ? { pinned: false }
          : {
              pinned: true,
              pinnedOrder:
                Math.max(-1, ...snapshot().bots.map((item) => item.meta.pinnedOrder ?? -1)) + 1
            }
      ),
    moveBot: (bot, folderId) =>
      saveBotMeta(backend, bot.name, {
        pinned: false,
        sectionId: folderId,
        sectionName: snapshot().folders.find((folder) => folder.id === folderId)?.name ?? null
      }),
    moveRoom: (roomId, folderId) =>
      saveRoomFolders(
        backend,
        (roomFolders) => ({ ...roomFolders, [roomId]: folderId }),
        snapshot().roomFolders
      ),
    nest: (id, parentId) => saveLayout((value) => moveFolder(value, id, parentId)),
    orderFolder: (id, direction) =>
      saveLayout((value) => {
        const folder = value.find((item) => item.id === id)
        const siblings = value.filter((item) => item.parentId === folder?.parentId)
        const target = siblings[siblings.findIndex((item) => item.id === id) + direction]
        return target
          ? reorder(
              value,
              value.findIndex((item) => item.id === id),
              value.findIndex((item) => item.id === target.id)
            )
          : value
      }),
    orderPin: (from, to) => orderPin(backend, snapshot().bots, { from, to }),
    addFolder: (name) =>
      saveLayout((value) => [...value, { id: crypto.randomUUID(), name: name.trim() }]),
    hide: (bot) => saveBotMeta(backend, bot.name, { hidden: !bot.meta.hidden }),
    deleteProfile: (bot) => backend.deleteProfile(bot.name)
  }
}

let pending = 0
let queue: Promise<void> = Promise.resolve()

// Mutations run one at a time so a quick second action waits instead of being lost.
export function runRosterMutation(
  backend: RosterBackend,
  operation: () => Promise<void>
): Promise<void> {
  pending++
  useRoster.setState((state) => ({ saving: true, error: null, revision: state.revision + 1 }))
  queue = queue
    .then(() => mutate(backend, operation))
    .finally(() => {
      if (--pending === 0) useRoster.setState({ saving: false })
    })
  return queue
}

async function mutate(backend: RosterBackend, operation: () => Promise<void>): Promise<void> {
  let failure: RosterProblem | null = null
  try {
    await operation()
  } catch (error) {
    failure = problemOf(error)
  }
  try {
    await refreshRoster(backend)
  } catch (error) {
    // The operation's own failure is the one the user can act on.
    useRoster.setState({ loading: false, error: failure ?? problemOf(error) })
    return
  }
  if (failure) useRoster.setState({ error: failure })
}

// Writes only the pins whose position changed; a bot dropped onto the pins joins them.
async function orderPin(
  backend: RosterBackend,
  bots: Bot[],
  move: { from: string; to: string }
): Promise<void> {
  const pins = pinnedBots(bots)
  const source = bots.find((bot) => bot.name === move.from)
  const target = pins.findIndex((bot) => bot.name === move.to)
  if (!source || target < 0 || move.from === move.to) return
  const next = pins.filter((bot) => bot.name !== move.from)
  next.splice(target, 0, source)
  for (const [pinnedOrder, bot] of next.entries()) {
    if (!bot.meta.pinned) await saveBotMeta(backend, bot.name, { pinned: true, pinnedOrder })
    else if (bot.meta.pinnedOrder !== pinnedOrder)
      await saveBotMeta(backend, bot.name, { pinnedOrder })
  }
}
