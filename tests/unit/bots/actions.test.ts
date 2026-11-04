import { beforeEach, describe, expect, it } from 'vitest'
import {
  refreshRoster,
  rosterActions,
  runRosterMutation
} from '../../../src/renderer/src/features/bots/actions'
import type { RosterBackend } from '../../../src/renderer/src/features/bots/data'
import { folderBots, pinnedBots } from '../../../src/renderer/src/features/bots/roster'
import { useRoster } from '../../../src/renderer/src/features/bots/store'
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
    snapshot: { bots: [], folders: [], rooms: [], roomFolders: {} },
    selection: null,
    error: null,
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
    await act(() => rosterActions(backend).nest('clients', 'team'))
    expect(roster().folders).toContainEqual({ id: 'clients', name: 'Clients', parentId: 'team' })
    await act(() => rosterActions(backend).nest('team', 'clients'))
    expect(useRoster.getState().error?.key).toBe('roster.errorFolderCycle')
    expect(roster().folders).toContainEqual({ id: 'team', name: 'Team' })
  })
  it('should swap a folder with its next sibling and ignore a move past the end', async () => {
    await act(() => rosterActions(backend).orderFolder('team', 1))
    expect(roster().folders.map((folder) => folder.id)).toEqual(['clients', 'team'])
    await act(() => rosterActions(backend).orderFolder('team', 1))
    expect(roster().folders.map((folder) => folder.id)).toEqual(['clients', 'team'])
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
    await act(() => rosterActions(backend).addFolder('  Research  '))
    expect(roster().folders.map((folder) => folder.name)).toEqual(['Team', 'Clients', 'Research'])
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

describe('roster mutations', () => {
  it('should run a second action started while the first is saving instead of dropping it', async () => {
    const actions = rosterActions(backend)
    await Promise.all([
      act(() => actions.hide(bot('support'))),
      act(() => actions.addFolder('Research'))
    ])
    expect(bot('support').meta?.hidden).toBe(true)
    expect(roster().folders.map((folder) => folder.name)).toContain('Research')
    expect(useRoster.getState().saving).toBe(false)
  })
  it('should show the error and keep the current roster when a save fails', async () => {
    await act(async () => {
      throw new Error('Engine offline')
    })
    expect(useRoster.getState().error).toEqual({
      key: 'roster.errorUnexpected',
      detail: 'Engine offline'
    })
    expect(roster().bots).toHaveLength(5)
  })
  it('should report a failed reload once', async () => {
    backend.request = async () => {
      throw new Error('Engine offline')
    }
    await act(() => Promise.resolve())
    expect(useRoster.getState().error).toEqual({
      key: 'roster.errorUnexpected',
      detail: 'Engine offline'
    })
  })
  it('should clear the selection of a bot hidden on another client', async () => {
    useRoster.getState().select({ kind: 'bot', id: 'support' })
    engine.metadata.support[BOT_META_KEY] = { sectionId: 'clients', hidden: true }
    await refreshRoster(backend)
    expect(useRoster.getState().selection).toBeNull()
  })
})
