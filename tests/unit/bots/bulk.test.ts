import { beforeEach, describe, expect, it } from 'vitest'
import {
  refreshRoster,
  rosterActions,
  runRosterMutation
} from '../../../src/renderer/src/features/bots/actions'
import { bulkChoices } from '../../../src/renderer/src/features/bots/bulk'
import type { RosterBackend } from '../../../src/renderer/src/features/bots/data'
import {
  folderItems,
  itemKey,
  itemRef,
  pinnedBots,
  pinnedRooms
} from '../../../src/renderer/src/features/bots/roster'
import { useRoster } from '../../../src/renderer/src/features/bots/store'
import type { RosterRowRef } from '../../../src/renderer/src/features/bots/types'
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
    loading: true,
    picked: [],
    unread: {},
    roomUnread: {}
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
      writer: member('team'),
      planner: member('team'),
      support: member('clients')
    },
    [
      { room_id: 'team-room', name: 'Team room', members: [] },
      { room_id: 'clients-room', name: 'Clients room', members: [] }
    ]
  )
  backend = backendFor(engine)
  await refreshRoster(backend)
  // Archive holds nothing yet; Clients sits at the top level beside Team.
  await act(() => actions().addFolder('Archive', null))
  engine.configureCalls.length = 0
})

const actions = (): ReturnType<typeof rosterActions> => rosterActions(backend)
const act = (operation: () => Promise<void>): Promise<void> => runRosterMutation(backend, operation)
const roster = (): ReturnType<typeof useRoster.getState>['snapshot'] =>
  useRoster.getState().snapshot
const folderId = (name: string): string =>
  roster().folders.find((folder) => folder.name === name)!.id
const rowKeys = (folder: string | null): string[] =>
  folderItems(roster(), folder).map((item) => itemKey(itemRef(item)))
const bot = (id: string): RosterRowRef => ({ kind: 'bot', id })
const room = (id: string): RosterRowRef => ({ kind: 'room', id })
const folder = (id: string): RosterRowRef => ({ kind: 'folder', id })
const layoutSaves = (): string[] =>
  engine.configureCalls.filter((call) => call.startsWith('default:'))

describe('moving several picked rows', () => {
  it('should move one bot into another folder', async () => {
    await act(() => actions().moveRows([bot('support')], 'team'))
    expect(rowKeys('team')).toContain('bot:support')
    expect(rowKeys('clients')).toEqual(['room:clients-room'])
  })
  it('should move many bots and rooms in their order with one layout save, out of the pins', async () => {
    await act(() =>
      actions().placeRows([bot('analyst'), room('clients-room'), bot('support')], {
        folderId: 'team',
        before: 'bot:planner'
      })
    )
    expect(rowKeys('team')).toEqual([
      'bot:writer',
      'bot:analyst',
      'room:clients-room',
      'bot:support',
      'bot:planner',
      'room:team-room'
    ])
    expect(pinnedBots(roster().bots)).toEqual([])
    expect(layoutSaves()).toHaveLength(1)
    expect(engine.configureCalls).toEqual([
      'default:talyx-room-folders+talyx-room-pins+talyx-item-order',
      `analyst:${BOT_META_KEY}`,
      `support:${BOT_META_KEY}`
    ])
  })
  it('should bring a picked folder’s contents along and keep picked rows inside it there', async () => {
    const archive = folderId('Archive')
    await act(() => actions().moveRows([folder('clients'), bot('support'), bot('writer')], archive))
    expect(roster().folders).toContainEqual({ id: 'clients', name: 'Clients', parentId: archive })
    expect(rowKeys('clients')).toEqual(['bot:support', 'room:clients-room'])
    expect(rowKeys(archive)).toEqual(['bot:writer'])
    expect(layoutSaves()).toEqual(['default:talyx-folders+talyx-item-order'])
  })
  it('should refuse a drop into a picked folder’s own child and save nothing', async () => {
    await act(() =>
      actions().placeFolder({ id: folderId('Archive'), parentId: 'team', beforeId: null })
    )
    engine.configureCalls.length = 0
    await act(() => actions().moveRows([folder('team'), bot('support')], folderId('Archive')))
    expect(useRoster.getState().actionError?.key).toBe('roster.errorFolderCycle')
    expect(engine.configureCalls).toEqual([])
    expect(roster().folders.find((item) => item.id === 'team')?.parentId).toBeUndefined()
  })
  it('should leave every bot where it was when the layout save fails', async () => {
    engine.failMetaOnce()
    await act(() => actions().moveRows([bot('writer'), room('team-room')], 'clients'))
    expect(useRoster.getState().actionError).not.toBeNull()
    expect(rowKeys('team')).toEqual(['bot:writer', 'bot:planner', 'room:team-room'])
  })
  it('should save again on a fresh revision when another client changed the layout', async () => {
    engine.conflictOnce()
    await act(() => actions().moveRows([bot('writer'), bot('planner')], 'clients'))
    expect(useRoster.getState().actionError).toBeNull()
    expect(rowKeys('clients')).toEqual([
      'bot:support',
      'room:clients-room',
      'bot:writer',
      'bot:planner'
    ])
    expect(layoutSaves()).toEqual(['default:talyx-item-order', 'default:talyx-item-order'])
  })
})

describe('acting on several picked rows', () => {
  it.each([
    [
      'bots',
      [bot('writer'), bot('planner')],
      { pin: 'pin', markRead: true, hide: true, delete: true }
    ],
    ['pinned bots', [bot('analyst')], { pin: 'unpin', markRead: true, hide: true, delete: true }],
    [
      'bots and rooms',
      [bot('writer'), room('team-room')],
      { pin: 'pin', markRead: true, hide: false, delete: true }
    ],
    [
      'a folder among them',
      [bot('writer'), folder('team')],
      { pin: null, markRead: false, hide: false, delete: true }
    ],
    [
      'Talyx among them',
      [bot('default'), bot('writer')],
      { pin: 'pin', markRead: true, hide: false, delete: false }
    ]
  ] as const)('should offer only the shared actions for %s', (_, rows, choices) => {
    expect(bulkChoices(roster(), [...rows])).toEqual(choices)
  })
  it('should pin a mix of bots and rooms, then unpin them all once every one is pinned', async () => {
    const rows = [bot('writer'), room('team-room'), bot('analyst')]
    await act(() => actions().pinRows(rows))
    expect(pinnedBots(roster().bots).map((item) => item.name)).toEqual(['analyst', 'writer'])
    expect(pinnedRooms(roster()).map((item) => item.room_id)).toEqual(['team-room'])
    await act(() => actions().pinRows(rows))
    expect(pinnedBots(roster().bots)).toEqual([])
    expect(roster().roomPins).toEqual([])
  })
  it('should mark the picked bots and rooms read', () => {
    useRoster.setState({
      unread: { writer: true, planner: true },
      roomUnread: { 'team-room': true }
    })
    useRoster.getState().markRead([bot('writer'), room('team-room')])
    expect(useRoster.getState().unread).toEqual({ writer: false, planner: true })
    expect(useRoster.getState().roomUnread).toEqual({ 'team-room': false })
  })
  it('should hide many bots and drop them from the picked rows', async () => {
    useRoster.setState({ picked: ['bot:writer', 'bot:planner', 'room:team-room'] })
    await act(() => actions().hideRows([bot('writer'), bot('planner')]))
    expect(
      roster()
        .bots.filter((item) => item.meta.hidden)
        .map((item) => item.name)
    ).toEqual(['writer', 'planner'])
    expect(useRoster.getState().picked).toEqual(['room:team-room'])
  })
})

describe('deleting several picked rows', () => {
  it('should delete bots, rooms and a folder whose other contents move up, in one layout save', async () => {
    await act(() => actions().deleteRows([bot('writer'), room('team-room'), folder('clients')]))
    expect(engine.deleted).toEqual(['writer'])
    expect(roster().rooms.map((item) => item.room_id)).toEqual(['clients-room'])
    expect(roster().folders.map((item) => item.id)).not.toContain('clients')
    expect(rowKeys(null)).toEqual(['bot:default', 'bot:support', 'room:clients-room'])
    expect(rowKeys('team')).toEqual(['bot:planner'])
    expect(layoutSaves()).toEqual([
      'default:talyx-folders+talyx-item-order+talyx-room-folders+talyx-room-pins'
    ])
  })
  it('should move a deleted folder’s contents past a deleted subfolder to the folder that stays', async () => {
    const archive = folderId('Archive')
    await act(() => actions().placeFolder({ id: 'team', parentId: archive, beforeId: null }))
    await act(() => actions().placeFolder({ id: 'clients', parentId: 'team', beforeId: null }))
    await act(() => actions().deleteRows([folder('team'), folder('clients'), bot('support')]))
    expect(roster().folders.map((item) => item.id)).toEqual([archive])
    expect(rowKeys(archive)).toEqual([
      'bot:writer',
      'bot:planner',
      'room:team-room',
      'room:clients-room'
    ])
  })
  it('should refuse to delete Talyx’s own bot along with others', async () => {
    await act(() => actions().deleteRows([bot('default'), bot('writer')]))
    expect(useRoster.getState().actionError?.key).toBe('roster.errorKeepTalyx')
    expect(engine.deleted).toEqual([])
  })
})
