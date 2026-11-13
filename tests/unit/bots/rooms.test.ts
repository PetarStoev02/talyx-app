import { beforeEach, describe, expect, it } from 'vitest'
import {
  applySnapshot,
  refreshRoster,
  rosterActions,
  runRosterMutation
} from '../../../src/renderer/src/features/bots/actions'
import type { RosterBackend } from '../../../src/renderer/src/features/bots/data'
import {
  MAX_ROOM_MEMBERS,
  MIN_ROOM_MEMBERS,
  changeRoomMembers,
  createRoom,
  renameRoom,
  seatableProfiles
} from '../../../src/renderer/src/features/bots/rooms'
import { folderRooms, pinnedRooms } from '../../../src/renderer/src/features/bots/roster'
import { useRoster } from '../../../src/renderer/src/features/bots/store'
import type { Bot, Room, RosterSnapshot } from '../../../src/renderer/src/features/bots/types'
import { BOT_META_KEY, backendFor, engineDouble } from './engineDouble'
import type { EngineDouble } from './engineDouble'

const filed = (sectionId: string, title: string): Record<string, unknown> => ({
  [BOT_META_KEY]: { title, sectionId, sectionName: 'Team' }
})

let engine: EngineDouble
let backend: RosterBackend

beforeEach(async () => {
  useRoster.setState({
    snapshot: { bots: [], folders: [], rooms: [], roomFolders: {}, roomPins: [], itemOrder: {} },
    selection: null,
    roomUnread: {},
    roomSeen: {},
    actionError: null,
    loadError: null,
    saving: false
  })
  engine = engineDouble(
    {
      default: { 'talyx-folders': [{ id: 'team', name: 'Team' }] },
      analyst: filed('team', 'Analyst'),
      writer: filed('team', 'Writer'),
      planner: filed('team', 'Planner')
    },
    [
      { room_id: 'standup', name: 'Standup', members: [{ profile: 'analyst' }] },
      { room_id: 'review', name: 'Review', members: [{ profile: 'writer' }] }
    ]
  )
  backend = backendFor(engine)
  await refreshRoster(backend)
})

const snapshot = (): RosterSnapshot => useRoster.getState().snapshot
const bot = (name: string): Bot => snapshot().bots.find((item) => item.name === name)!
const room = (id: string): Room => snapshot().rooms.find((item) => item.room_id === id)!
const act = (operation: () => Promise<void>): Promise<void> => runRosterMutation(backend, operation)
const roomIds = (folderId: string | null): string[] =>
  folderRooms(snapshot(), folderId).map((item) => item.room_id)

describe('group rooms in the roster', () => {
  describe('creating', () => {
    it('should seat the chosen bots by profile, Talyx under its own handle', async () => {
      let id = ''
      await act(async () => {
        id = await createRoom(backend, {
          name: '  Pricing  ',
          members: [bot('default'), bot('analyst')]
        })
      })
      const create = engine.rooms.find((item) => item.room_id === id)
      expect(create).toMatchObject({
        name: 'Pricing',
        members: [
          {
            member_id: 'default',
            profile: 'default',
            handle: 'talyx',
            display_name: 'Talyx',
            target: { kind: 'local', profile: 'default' }
          },
          { member_id: 'analyst', profile: 'analyst', handle: 'analyst', display_name: 'Analyst' }
        ]
      })
      expect(room(id).name).toBe('Pricing')
    })

    it.each([1, 7])('should refuse a room of %i bots before asking the engine', async (count) => {
      const members = Array.from({ length: count }, () => bot('analyst'))
      await expect(createRoom(backend, { name: 'Too few or many', members })).rejects.toMatchObject(
        { key: 'rooms.errorMembers' }
      )
      expect(engine.rooms).toHaveLength(2)
    })

    it('should file a new room in the chosen folder', async () => {
      await act(async () => {
        const id = await createRoom(backend, {
          name: 'Pricing',
          members: [bot('analyst'), bot('writer')]
        })
        await rosterActions(backend).moveRoom(id, 'team')
      })
      expect(folderRooms(snapshot(), 'team').map((item) => item.name)).toEqual(['Pricing'])
    })

    it('should offer only the bots the engine will seat', async () => {
      expect(await seatableProfiles(backend)).toBeNull()
      engine.seatable = ['default', 'analyst']
      expect(await seatableProfiles(backend)).toEqual(['default', 'analyst'])
    })
  })

  describe('pinning', () => {
    it('should move a pinned room out of its folder to the pins, and back when unpinned', async () => {
      expect(roomIds(null)).toEqual(['standup', 'review'])
      await act(() => rosterActions(backend).pinRoom(room('review')))
      expect(engine.metadata.default['talyx-room-pins']).toEqual(['review'])
      expect(roomIds(null)).toEqual(['standup'])
      expect(pinnedRooms(snapshot()).map((item) => item.room_id)).toEqual(['review'])
      await act(() => rosterActions(backend).pinRoom(room('review')))
      expect(roomIds(null)).toEqual(['standup', 'review'])
      expect(pinnedRooms(snapshot())).toEqual([])
    })

    it('should unpin a pinned room that is moved to a folder, as it does a bot', async () => {
      await act(() => rosterActions(backend).pinRoom(room('review')))
      await act(() => rosterActions(backend).moveRoom('review', 'team'))
      expect(pinnedRooms(snapshot())).toEqual([])
      expect(engine.metadata.default['talyx-room-pins']).toEqual([])
      expect(roomIds('team')).toEqual(['review'])
    })

    it('should keep pinned rooms in the order they were pinned', async () => {
      await act(() => rosterActions(backend).pinRoom(room('review')))
      await act(() => rosterActions(backend).pinRoom(room('standup')))
      expect(pinnedRooms(snapshot()).map((item) => item.room_id)).toEqual(['review', 'standup'])
    })

    it('should drop a pin whose room is gone', () => {
      useRoster.setState({ snapshot: { ...snapshot(), roomPins: ['gone', 'review'] } })
      expect(pinnedRooms(snapshot()).map((item) => item.room_id)).toEqual(['review'])
    })
  })

  describe('changing who is in a room', () => {
    it('should add and remove bots in the same room, as the engine stores them', async () => {
      await act(() =>
        changeRoomMembers(backend, { roomId: 'standup', members: [bot('writer'), bot('planner')] })
      )
      expect(engine.rooms[0]).toMatchObject({ room_id: 'standup', name: 'Standup' })
      expect(engine.rooms[0].members).toEqual([
        {
          member_id: 'writer',
          profile: 'writer',
          handle: 'writer',
          display_name: 'Writer',
          target: { kind: 'local', profile: 'writer' }
        },
        {
          member_id: 'planner',
          profile: 'planner',
          handle: 'planner',
          display_name: 'Planner',
          target: { kind: 'local', profile: 'planner' }
        }
      ])
      expect(room('standup').members.map((member) => member.profile)).toEqual(['writer', 'planner'])
    })

    it.each([
      ['one bot', ['analyst']],
      ['seven bots', ['analyst', 'writer', 'planner', 'analyst', 'writer', 'planner', 'analyst']]
    ])('should refuse a room with %s, changing nothing', async (_label, names) => {
      await act(() =>
        changeRoomMembers(backend, { roomId: 'standup', members: names.map((name) => bot(name)) })
      )
      expect(useRoster.getState().actionError).toMatchObject({ key: 'rooms.errorMembers' })
      expect(engine.rooms[0].members).toEqual([{ profile: 'analyst' }])
    })
  })

  describe('renaming', () => {
    it('should rename the room for every client and show the new name', async () => {
      await act(() => renameRoom(backend, { roomId: 'standup', name: '  Daily standup ' }))
      expect(engine.rooms[0].name).toBe('Daily standup')
      expect(room('standup').name).toBe('Daily standup')
    })

    it('should refuse a blank name without asking the engine', async () => {
      await act(() => renameRoom(backend, { roomId: 'standup', name: '   ' }))
      expect(useRoster.getState().actionError).toMatchObject({ key: 'rooms.errorName' })
      expect(engine.rooms[0].name).toBe('Standup')
    })
  })

  describe('deleting', () => {
    it('should disband the room and drop its folder and pin from the shared layout', async () => {
      await act(() => rosterActions(backend).moveRoom('standup', 'team'))
      await act(() => rosterActions(backend).moveRoom('review', 'team'))
      await act(() => rosterActions(backend).pinRoom(room('standup')))
      useRoster.getState().select({ kind: 'room', id: 'standup' })
      const standup = room('standup')
      await act(async () => {
        await rosterActions(backend).deleteRoom(standup)
        await rosterActions(backend).forgetRoom(standup)
      })
      expect(engine.rooms.map((item) => item.room_id)).toEqual(['review'])
      expect(snapshot().rooms.map((item) => item.room_id)).toEqual(['review'])
      expect(engine.metadata.default['talyx-room-folders']).toEqual({ review: 'team' })
      expect(engine.metadata.default['talyx-room-pins']).toEqual([])
      expect(useRoster.getState().selection).toBeNull()
    })

    it('should show why a room could not be deleted and keep it', async () => {
      engine.rooms.splice(0, 1)
      await act(() => rosterActions(backend).deleteRoom({ ...room('review'), room_id: 'gone' }))
      expect(useRoster.getState().actionError).toMatchObject({ detail: 'Room not found' })
      expect(snapshot().rooms.map((item) => item.room_id)).toEqual(['review'])
    })
  })

  describe('new messages', () => {
    // The roster read in the outer setup counts as a first snapshot; these start before it.
    beforeEach(() => useRoster.setState({ roomSeen: {}, roomUnread: {} }))

    const withLatest = (latest: Record<string, number>): RosterSnapshot => ({
      ...snapshot(),
      rooms: Object.entries(latest).map(([id, seq]) => ({
        room_id: id,
        name: id,
        members: [],
        latest_seq: seq
      }))
    })

    it('should not mark rooms on the first snapshot', () => {
      applySnapshot(withLatest({ standup: 4 }))
      expect(useRoster.getState().roomUnread).toEqual({})
    })

    it('should mark a room whose log grew while it was not open', () => {
      applySnapshot(withLatest({ standup: 4, review: 2 }))
      applySnapshot(withLatest({ standup: 6, review: 2 }))
      expect(useRoster.getState().roomUnread).toEqual({ standup: true })
      useRoster.getState().select({ kind: 'room', id: 'standup' })
      expect(useRoster.getState().roomUnread.standup).toBe(false)
    })

    it('should not mark the open room, nor what you read there before leaving', () => {
      applySnapshot(withLatest({ standup: 4 }))
      useRoster.getState().select({ kind: 'room', id: 'standup' })
      applySnapshot(withLatest({ standup: 5 }))
      useRoster.getState().seeRoom('standup', 7)
      useRoster.getState().select(null)
      applySnapshot(withLatest({ standup: 7 }))
      expect(useRoster.getState().roomUnread.standup).toBeFalsy()
      applySnapshot(withLatest({ standup: 8 }))
      expect(useRoster.getState().roomUnread.standup).toBe(true)
    })
  })
})

describe('rooms over a fake backend', () => {
  const calls: string[] = []
  const fake = {
    createRoom: async (): Promise<void> => void calls.push('createRoom'),
    renameRoom: async (): Promise<void> => void calls.push('renameRoom')
  }
  const members = (count: number): Bot[] =>
    Array.from({ length: count }, (_, index) => ({ name: `bot-${index}`, meta: {} }))

  beforeEach(() => {
    calls.length = 0
  })

  it.each([MIN_ROOM_MEMBERS - 1, MAX_ROOM_MEMBERS + 1])(
    'should refuse a room of %i bots before asking the engine',
    async (count) => {
      await expect(
        createRoom(fake, { name: 'Standup', members: members(count) })
      ).rejects.toMatchObject({ key: 'rooms.errorMembers' })
      expect(calls).toEqual([])
    }
  )

  it('should refuse a blank room name before asking the engine', async () => {
    await expect(renameRoom(fake, { roomId: 'standup', name: '   ' })).rejects.toMatchObject({
      key: 'rooms.errorName'
    })
    expect(calls).toEqual([])
  })
})
