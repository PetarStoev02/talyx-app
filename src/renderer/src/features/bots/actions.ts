import {
  readRoster,
  saveBotMeta,
  saveFolders,
  saveItemOrder,
  saveRoomFolders,
  saveRoomPins
} from './data'
import type { RosterStore } from './data'
import { deleteRows, hideRows, moveRows, pinRows } from './bulk'
import {
  folderItems,
  itemFolder,
  itemKey,
  itemRef,
  orderKey,
  pinnedBots,
  placeFolder,
  placeKey,
  problemOf,
  rowOf,
  RosterError
} from './roster'
import type { RosterProblem } from './roster'
import { useRoster } from './store'
import type { RosterState } from './store'
import { sameJson } from '@shared/lib/utils'
import type { Bot, Folder, Room, RosterItemRef, RosterRowRef, RosterSnapshot } from './types'

export interface RosterActions {
  pin: (bot: Bot) => Promise<void>
  moveBot: (bot: Bot, folderId: string | null) => Promise<void>
  moveRoom: (roomId: string, folderId: string | null) => Promise<void>
  pinRoom: (room: Room) => Promise<void>
  deleteRoom: (room: Room) => Promise<void>
  /** Drop a deleted room's folder and pin from the shared layout. */
  forgetRoom: (room: Room) => Promise<void>
  /** A folder under `parentId` (null: top level), in front of `beforeId` or last. */
  placeFolder: (move: {
    id: string
    parentId: string | null
    beforeId: string | null
  }) => Promise<void>
  renameFolder: (id: string, name: string) => Promise<void>
  /** Removes the folder; what was in it moves up to its parent folder, or to Unassigned. */
  deleteFolder: (id: string) => Promise<void>
  /** A bot or room into `folderId`, in front of the item keyed `before` or last. */
  placeItem: (
    item: RosterItemRef,
    place: { folderId: string | null; before: string | null }
  ) => Promise<void>
  /** One step earlier (-1) or later (1) in its folder: the keyboard's way to sort. */
  stepItem: (item: RosterItemRef, direction: -1 | 1) => Promise<void>
  orderPin: (from: string, to: string) => Promise<void>
  /** A new folder, last at the top level (`parentId` null) or inside `parentId`. */
  addFolder: (name: string, parentId: string | null) => Promise<void>
  hide: (bot: Bot) => Promise<void>
  deleteProfile: (bot: Bot) => Promise<void>
  // Several picked rows at once (bulk.ts), in the order they show.
  moveRows: (rows: RosterRowRef[], folderId: string | null) => Promise<void>
  /** Dragged rows into `folderId`, in front of the row keyed `before` or last. */
  placeRows: (
    rows: RosterRowRef[],
    place: { folderId: string | null; before: string | null }
  ) => Promise<void>
  pinRows: (rows: RosterRowRef[]) => Promise<void>
  hideRows: (rows: RosterRowRef[]) => Promise<void>
  deleteRows: (rows: RosterRowRef[]) => Promise<void>
}

export async function refreshRoster(backend: RosterStore): Promise<void> {
  applySnapshot(await readRoster(backend))
}

// A bot hidden or deleted on another client must not stay selected. A chat that moved since the
// last snapshot got a reply, including from sessions this window never opened (bot deliveries).
// A room whose log grew past what was last read has new messages. Marks of deleted bots and rooms
// go, so a new bot with a deleted one's name starts clean.
// ponytail: the log also counts rows the transcript hides (settled turns, finished rounds), so a
// room left just before those land can show a dot with nothing new; count only messages if it bites.
export function applySnapshot(next: RosterSnapshot): void {
  const state = useRoster.getState()
  const { selection } = state
  // A poll that read the same roster keeps the snapshot it has, so nothing redraws.
  const snapshot = sameJson(state.snapshot, next) ? state.snapshot : next
  const bots = new Set(snapshot.bots.map((bot) => bot.name))
  const rooms = new Set(snapshot.rooms.map((room) => room.room_id))
  const unread = only(state.unread, bots)
  const roomUnread = only(state.roomUnread, rooms)
  const seen: Record<string, number> = {}
  for (const bot of snapshot.bots) {
    // 0 for a bot with no chat yet, so the first chat a delivery opens also reads as a reply.
    const active = bot.canonical_session?.last_active ?? 0
    const before = state.seen[bot.name]
    seen[bot.name] = active
    if (before !== undefined && active > before)
      unread[bot.name] = !(selection?.kind === 'bot' && selection.id === bot.name)
  }
  const roomSeen: Record<string, number> = {}
  for (const room of snapshot.rooms) {
    const latest = room.latest_seq ?? 0
    const read = state.roomSeen[room.room_id]
    roomSeen[room.room_id] = Math.max(latest, read ?? 0)
    if (read !== undefined && latest > read)
      roomUnread[room.room_id] = !(selection?.kind === 'room' && selection.id === room.room_id)
  }
  const exists =
    selection?.kind === 'bot'
      ? snapshot.bots.some((bot) => bot.name === selection.id && !bot.meta.hidden)
      : rooms.has(selection?.id ?? '')
  const change = changes(state, {
    snapshot,
    unread,
    roomUnread,
    seen,
    roomSeen,
    activity: only(state.activity, bots),
    picked: state.picked.filter((key) => onRoster(snapshot, rowOf(key))),
    loading: false,
    loadError: null,
    ...(selection && !exists ? { selection: null } : {})
  })
  if (Object.keys(change).length > 0) useRoster.setState(change)
}

// A picked row that was deleted or hidden, here or on another client, is no longer picked.
function onRoster(snapshot: RosterSnapshot, row: RosterRowRef): boolean {
  if (row.kind === 'bot')
    return snapshot.bots.some((bot) => bot.name === row.id && !bot.meta.hidden)
  if (row.kind === 'room') return snapshot.rooms.some((room) => room.room_id === row.id)
  return snapshot.folders.some((folder) => folder.id === row.id)
}

function only<T>(marks: Record<string, T>, ids: Set<string>): Record<string, T> {
  return Object.fromEntries(Object.entries(marks).filter(([id]) => ids.has(id)))
}

// Only the fields that differ; marks compare by their entries, since each poll rebuilds them.
function changes(state: RosterState, values: Partial<RosterState>): Partial<RosterState> {
  return Object.fromEntries(
    Object.entries(values).filter(([key, value]) => !alike(state[key as keyof RosterState], value))
  )
}

function alike(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  const entries = Object.entries(a)
  return (
    entries.length === Object.keys(b).length &&
    entries.every(([key, value]) => (b as Record<string, unknown>)[key] === value)
  )
}

export function rosterActions(backend: RosterStore): RosterActions {
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
    // Moving a pinned room puts it in the folder, as moving a pinned bot does.
    moveRoom: async (roomId, folderId) => {
      await saveRoomFolders(
        backend,
        (roomFolders) => ({ ...roomFolders, [roomId]: folderId }),
        snapshot().roomFolders
      )
      if (snapshot().roomPins.includes(roomId))
        await saveRoomPins(backend, (pins) => pins.filter((id) => id !== roomId))
    },
    pinRoom: (room) =>
      saveRoomPins(backend, (pins) =>
        pins.includes(room.room_id)
          ? pins.filter((id) => id !== room.room_id)
          : [...pins, room.room_id]
      ),
    deleteRoom: (room) => backend.deleteRoom(room.room_id),
    forgetRoom: async (room) => {
      const { roomFolders, roomPins } = snapshot()
      if (room.room_id in roomFolders)
        await saveRoomFolders(
          backend,
          (folders) =>
            Object.fromEntries(Object.entries(folders).filter(([id]) => id !== room.room_id)),
          roomFolders
        )
      if (roomPins.includes(room.room_id))
        await saveRoomPins(backend, (pins) => pins.filter((id) => id !== room.room_id))
    },
    placeFolder: (move) => saveLayout((value) => placeFolder(value, move)),
    renameFolder: (id, name) =>
      saveLayout((value) => {
        if (!value.some((folder) => folder.id === id))
          throw new RosterError('roster.errorFolderGone')
        return value.map((folder) => (folder.id === id ? { ...folder, name: name.trim() } : folder))
      }),
    deleteFolder: (id) => deleteRows(backend, snapshot(), [{ kind: 'folder', id }]),
    placeItem: (item, place) => placeItem(backend, snapshot(), { item, ...place }),
    stepItem: (item, direction) => {
      const current = snapshot()
      const folderId = itemFolder(current, item)
      const keys = folderItems(current, folderId).map((row) => itemKey(itemRef(row)))
      const index = keys.indexOf(itemKey(item))
      const target = index + direction
      if (index < 0 || target < 0 || target >= keys.length) return Promise.resolve()
      // Stepping down is going in front of the item after the next one (or last).
      const before = direction < 0 ? keys[target] : (keys[target + 1] ?? null)
      return saveFolderOrder(backend, folderId, placeKey(keys, itemKey(item), before))
    },
    orderPin: (from, to) => orderPin(backend, snapshot().bots, { from, to }),
    addFolder: (name, parentId) =>
      saveLayout((value) => {
        if (parentId && !value.some((folder) => folder.id === parentId))
          throw new RosterError('roster.errorFolderGone')
        const folder = { id: crypto.randomUUID(), name: name.trim() }
        return [...value, parentId ? { ...folder, parentId } : folder]
      }),
    hide: (bot) => saveBotMeta(backend, bot.name, { hidden: !bot.meta.hidden }),
    deleteProfile: (bot) => backend.deleteProfile(bot.name),
    moveRows: (rows, folderId) => moveRows(backend, snapshot(), { rows, folderId, before: null }),
    placeRows: (rows, place) => moveRows(backend, snapshot(), { rows, ...place }),
    pinRows: (rows) => pinRows(backend, snapshot(), rows),
    hideRows: (rows) => hideRows(backend, snapshot(), rows),
    deleteRows: (rows) => deleteRows(backend, snapshot(), rows)
  }
}

function saveFolderOrder(
  backend: RosterStore,
  folderId: string | null,
  keys: string[]
): Promise<void> {
  return saveItemOrder(backend, (order) => ({ ...order, [orderKey(folderId)]: keys }))
}

// A pinned item dropped in a folder leaves the pins, as "Move to" does.
async function placeItem(
  backend: RosterStore,
  snapshot: RosterSnapshot,
  place: { item: RosterItemRef; folderId: string | null; before: string | null }
): Promise<void> {
  const { item, folderId, before } = place
  const actions = rosterActions(backend)
  if (item.kind === 'bot') {
    const bot = snapshot.bots.find((candidate) => candidate.name === item.id)
    if (!bot) throw new RosterError('roster.errorProfileGone')
    if (bot.meta.pinned || itemFolder(snapshot, item) !== folderId)
      await actions.moveBot(bot, folderId)
  } else if (snapshot.roomPins.includes(item.id) || itemFolder(snapshot, item) !== folderId)
    await actions.moveRoom(item.id, folderId)
  const keys = folderItems(snapshot, folderId).map((row) => itemKey(itemRef(row)))
  await saveFolderOrder(backend, folderId, placeKey(keys, itemKey(item), before))
}

let pending = 0
let queue: Promise<void> = Promise.resolve()

// Mutations run one at a time so a quick second action waits instead of being lost.
export function runRosterMutation(
  backend: RosterStore,
  operation: () => Promise<void>
): Promise<void> {
  pending++
  useRoster.setState((state) => ({ saving: true, actionError: null, revision: state.revision + 1 }))
  queue = queue
    .then(() => mutate(backend, operation))
    .finally(() => {
      if (--pending === 0) useRoster.setState({ saving: false })
    })
  return queue
}

async function mutate(backend: RosterStore, operation: () => Promise<void>): Promise<void> {
  let failure: RosterProblem | null = null
  try {
    await operation()
  } catch (error) {
    failure = problemOf(error)
  }
  try {
    await refreshRoster(backend)
  } catch (error) {
    useRoster.setState({ loading: false, loadError: problemOf(error) })
  }
  if (failure) useRoster.setState({ actionError: failure })
}

// Writes only the pins whose position changed; a bot dropped onto the pins joins them.
async function orderPin(
  backend: RosterStore,
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
