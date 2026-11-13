import { beforeEach, describe, expect, it } from 'vitest'
import {
  refreshRoster,
  rosterActions,
  runRosterMutation
} from '../../../src/renderer/src/features/bots/actions'
import type { RosterBackend } from '../../../src/renderer/src/features/bots/data'
import {
  folderBots,
  folderItems,
  itemKey,
  itemRef,
  pinnedBots
} from '../../../src/renderer/src/features/bots/roster'
import { useRoster } from '../../../src/renderer/src/features/bots/store'
import { forgetDeleted } from '../../../src/renderer/src/app/providers/forgetDeleted'
import { useRooms } from '../../../src/renderer/src/features/chat/roomStore'
import { useChat } from '../../../src/renderer/src/features/chat/store'
import { BOT_META_KEY, GROUPS_META_KEY, backendFor, engineDouble } from './engineDouble'
import type { EngineDouble } from './engineDouble'

const member = (
  sectionId: string,
  extra: Record<string, unknown> = {}
): Record<string, unknown> => ({
  [BOT_META_KEY]: { sectionId, sectionName: sectionId === 'team' ? 'Team' : 'Clients', ...extra }
})

let engine: EngineDouble
let backend: RosterBackend

beforeEach(async () => {
  useRoster.setState({
    snapshot: { bots: [], folders: [], rooms: [], roomFolders: {}, roomPins: [], itemOrder: {} },
    selection: null,
    actionError: null,
    loadError: null,
    saving: false,
    loading: true
  })
  engine = engineDouble(
    {
      default: {
        [GROUPS_META_KEY]: {
          rooms: {
            a: { roomId: 'team-room', sectionId: 'team' },
            b: { roomId: 'clients-room', sectionId: 'clients' }
          }
        }
      },
      analyst: member('team', { pinned: true, pinnedOrder: 0 }),
      writer: member('team', { pinned: true, pinnedOrder: 1 }),
      planner: member('team', { pinned: true, pinnedOrder: 2 }),
      support: member('clients')
    },
    [
      { room_id: 'team-room', name: 'Team room', members: [] },
      { room_id: 'clients-room', name: 'Clients room', members: [] }
    ]
  )
  backend = backendFor(engine)
  await refreshRoster(backend)
})

const roster = (): ReturnType<typeof useRoster.getState>['snapshot'] =>
  useRoster.getState().snapshot
const bot = (name: string): ReturnType<typeof roster>['bots'][number] =>
  roster().bots.find((item) => item.name === name)!
const act = (operation: () => Promise<void>): Promise<void> => runRosterMutation(backend, operation)
const pinNames = (): string[] => pinnedBots(roster().bots).map((item) => item.name)
const rowKeys = (folderId: string | null): string[] =>
  folderItems(roster(), folderId).map((item) => itemKey(itemRef(item)))

describe('roster actions', () => {
  it('should pin a bot after the existing pins and return it to its folder when unpinned', async () => {
    await act(() => rosterActions(backend).pin(bot('support')))
    expect(pinNames()).toEqual(['analyst', 'writer', 'planner', 'support'])
    expect(folderBots(roster(), 'clients')).toEqual([])
    await act(() => rosterActions(backend).pin(bot('support')))
    expect(folderBots(roster(), 'clients').map((item) => item.name)).toEqual(['support'])
  })
  it('should unpin a bot moved into another folder', async () => {
    await act(() => rosterActions(backend).moveBot(bot('analyst'), 'clients'))
    expect(pinNames()).toEqual(['writer', 'planner'])
    expect(folderBots(roster(), 'clients').map((item) => item.name)).toEqual(['analyst', 'support'])
  })
  it('should keep the other rooms in their folders when one room moves', async () => {
    expect(roster().roomFolders).toEqual({ 'team-room': 'team', 'clients-room': 'clients' })
    await act(() => rosterActions(backend).moveRoom('team-room', null))
    expect(roster().roomFolders).toEqual({ 'team-room': null, 'clients-room': 'clients' })
  })
  it('should nest a folder and refuse to nest it inside its own child', async () => {
    await act(() =>
      rosterActions(backend).placeFolder({ id: 'clients', parentId: 'team', beforeId: null })
    )
    expect(roster().folders).toContainEqual({ id: 'clients', name: 'Clients', parentId: 'team' })
    await act(() =>
      rosterActions(backend).placeFolder({ id: 'team', parentId: 'clients', beforeId: null })
    )
    expect(useRoster.getState().actionError?.key).toBe('roster.errorFolderCycle')
    expect(roster().folders).toContainEqual({ id: 'team', name: 'Team' })
  })
  it('should put a dragged folder in front of the sibling it was dropped on, or last', async () => {
    await act(() =>
      rosterActions(backend).placeFolder({ id: 'clients', parentId: null, beforeId: 'team' })
    )
    expect(roster().folders.map((folder) => folder.id)).toEqual(['clients', 'team'])
    await act(() =>
      rosterActions(backend).placeFolder({ id: 'clients', parentId: null, beforeId: null })
    )
    expect(roster().folders.map((folder) => folder.id)).toEqual(['team', 'clients'])
  })
  it('should rename a folder with the name trimmed', async () => {
    await act(() => rosterActions(backend).renameFolder('team', '  Core team '))
    expect(roster().folders).toContainEqual({ id: 'team', name: 'Core team' })
  })
  it('should move a deleted folder’s bots, rooms, subfolders and order up to its parent', async () => {
    await act(() =>
      rosterActions(backend).placeFolder({ id: 'clients', parentId: 'team', beforeId: null })
    )
    await act(() =>
      rosterActions(backend).placeItem(
        { kind: 'room', id: 'clients-room' },
        { folderId: 'clients', before: 'bot:support' }
      )
    )
    await act(() => rosterActions(backend).deleteFolder('clients'))
    expect(roster().folders).toEqual([{ id: 'team', name: 'Team' }])
    expect(rowKeys('team')).toEqual(['room:team-room', 'room:clients-room', 'bot:support'])
  })
  it('should move a top-level folder’s bots and subfolders to Unassigned when it is deleted', async () => {
    await act(() =>
      rosterActions(backend).placeFolder({ id: 'clients', parentId: 'team', beforeId: null })
    )
    await act(() => rosterActions(backend).deleteFolder('team'))
    expect(roster().folders).toEqual([{ id: 'clients', name: 'Clients' }])
    expect(rowKeys(null)).toEqual(['bot:default', 'room:team-room'])
    expect(bot('analyst').meta.sectionId).toBeNull()
    expect(pinNames()).toEqual(['analyst', 'writer', 'planner'])
  })
  it('should sort bots and rooms together in a folder and keep the order across reloads', async () => {
    await act(() => rosterActions(backend).pin(bot('analyst')))
    expect(rowKeys('team')).toEqual(['bot:analyst', 'room:team-room'])
    await act(() =>
      rosterActions(backend).placeItem(
        { kind: 'room', id: 'team-room' },
        { folderId: 'team', before: 'bot:analyst' }
      )
    )
    await refreshRoster(backend)
    expect(rowKeys('team')).toEqual(['room:team-room', 'bot:analyst'])
  })
  it('should move a bot dragged into another folder to where it was dropped, out of the pins', async () => {
    await act(() =>
      rosterActions(backend).placeItem(
        { kind: 'bot', id: 'writer' },
        { folderId: 'clients', before: 'bot:support' }
      )
    )
    expect(rowKeys('clients')).toEqual(['bot:writer', 'bot:support', 'room:clients-room'])
    expect(pinNames()).toEqual(['analyst', 'planner'])
  })
  it('should step a bot later and earlier in its folder and ignore a step past either end', async () => {
    await act(() => rosterActions(backend).stepItem({ kind: 'bot', id: 'support' }, 1))
    expect(rowKeys('clients')).toEqual(['room:clients-room', 'bot:support'])
    await act(() => rosterActions(backend).stepItem({ kind: 'bot', id: 'support' }, 1))
    expect(rowKeys('clients')).toEqual(['room:clients-room', 'bot:support'])
    await act(() => rosterActions(backend).stepItem({ kind: 'bot', id: 'support' }, -1))
    expect(rowKeys('clients')).toEqual(['bot:support', 'room:clients-room'])
  })
  it('should reorder pins, writing only the bots whose position changed', async () => {
    engine.configureCalls.length = 0
    await act(() => rosterActions(backend).orderPin('planner', 'writer'))
    expect(pinNames()).toEqual(['analyst', 'planner', 'writer'])
    expect(engine.configureCalls).toEqual([`planner:${BOT_META_KEY}`, `writer:${BOT_META_KEY}`])
  })
  it('should not re-pin a bot another client unpinned while reordering', async () => {
    engine.metadata.writer[BOT_META_KEY] = { sectionId: 'team', pinned: false, pinnedOrder: 1 }
    await act(() => rosterActions(backend).orderPin('planner', 'analyst'))
    expect(pinNames()).toEqual(['planner', 'analyst'])
  })
  it('should add a folder after the existing ones with its name trimmed', async () => {
    await act(() => rosterActions(backend).addFolder('  Research  ', null))
    expect(roster().folders.map((folder) => folder.name)).toEqual(['Team', 'Clients', 'Research'])
  })
  it('should add a folder inside another one, and refuse a parent that is gone', async () => {
    await act(() => rosterActions(backend).addFolder('Finance', 'clients'))
    expect(roster().folders.find((folder) => folder.name === 'Finance')?.parentId).toBe('clients')
    await act(() => rosterActions(backend).addFolder('Lost', 'gone'))
    expect(useRoster.getState().actionError?.key).toBe('roster.errorFolderGone')
    expect(roster().folders.some((folder) => folder.name === 'Lost')).toBe(false)
  })
  it('should hide a bot from its folder and restore it', async () => {
    await act(() => rosterActions(backend).hide(bot('support')))
    expect(folderBots(roster(), 'clients')).toEqual([])
    await act(() => rosterActions(backend).hide(bot('support')))
    expect(folderBots(roster(), 'clients').map((item) => item.name)).toEqual(['support'])
  })
  it('should remove a deleted profile from the roster', async () => {
    await act(() => rosterActions(backend).deleteProfile(bot('support')))
    expect(engine.deleted).toEqual(['support'])
    expect(roster().bots.map((item) => item.name)).not.toContain('support')
  })
})

describe('roster polls', () => {
  it('should leave the store as it is when nothing changed', async () => {
    const before = useRoster.getState()
    await refreshRoster(backend)
    expect(useRoster.getState()).toBe(before)
  })
  it("should drop a deleted bot's marks and chat, and a deleted room's view", async () => {
    const off = useRoster.subscribe(forgetDeleted)
    useRoster.getState().markUnread('support')
    useRoster.getState().setActivity('support', 'working')
    useChat.getState().update('support', { sessionId: 'old-chat' })
    useChat.getState().update('writer', { sessionId: 'kept' })
    useRooms.getState().update('team-room', { live: true })
    delete engine.metadata.support
    engine.rooms.splice(
      engine.rooms.findIndex((item) => item.room_id === 'team-room'),
      1
    )
    try {
      await refreshRoster(backend)
    } finally {
      off()
    }
    expect(useRoster.getState().unread).not.toHaveProperty('support')
    expect(useRoster.getState().activity).not.toHaveProperty('support')
    expect(Object.keys(useChat.getState().chats)).toEqual(['writer'])
    expect(useRooms.getState().rooms).not.toHaveProperty('team-room')
  })
})

describe('roster mutations', () => {
  it('should run a second action started while the first is saving instead of dropping it', async () => {
    const actions = rosterActions(backend)
    await Promise.all([
      act(() => actions.hide(bot('support'))),
      act(() => actions.addFolder('Research', null))
    ])
    expect(bot('support').meta?.hidden).toBe(true)
    expect(roster().folders.map((folder) => folder.name)).toContain('Research')
    expect(useRoster.getState().saving).toBe(false)
  })
  it('should show the error and keep the current roster when a save fails', async () => {
    await act(async () => {
      throw new Error('Engine gateway is not connected')
    })
    expect(useRoster.getState().actionError).toEqual({
      key: 'error.engineUnreachable',
      detail: 'Engine gateway is not connected'
    })
    expect(roster().bots).toHaveLength(5)
  })
  it('should report a failed reload as a load problem, not as a failed action', async () => {
    backend.listBots = async () => {
      throw new Error('Engine gateway is not connected')
    }
    await act(() => Promise.resolve())
    expect(useRoster.getState().actionError).toBeNull()
    expect(useRoster.getState().loadError).toEqual({
      key: 'error.engineUnreachable',
      detail: 'Engine gateway is not connected'
    })
  })
  it('should keep a failed action showing when a later poll succeeds', async () => {
    await act(async () => {
      throw new Error('Engine gateway is not connected')
    })
    await refreshRoster(backend)
    expect(useRoster.getState().actionError?.detail).toBe('Engine gateway is not connected')
    // A selection made for the user, such as the fallback after a deleted chat, keeps it.
    useRoster.getState().select({ kind: 'bot', id: 'writer' })
    expect(useRoster.getState().actionError?.detail).toBe('Engine gateway is not connected')
  })
  it('should clear the selection of a bot hidden on another client', async () => {
    useRoster.getState().select({ kind: 'bot', id: 'support' })
    engine.metadata.support[BOT_META_KEY] = { sectionId: 'clients', hidden: true }
    await refreshRoster(backend)
    expect(useRoster.getState().selection).toBeNull()
  })
})
