import { describe, expect, it } from 'vitest'
import {
  hasSharedLayout,
  publishRecoveredLayout,
  readRoster,
  saveBotMeta,
  saveFolders
} from '../../../src/renderer/src/features/bots/data'
import type { RosterRequest } from '../../../src/renderer/src/features/bots/data'
import { moveFolder } from '../../../src/renderer/src/features/bots/roster'
import { BOT_META_KEY, backendFor, engineDouble } from './engineDouble'

describe('shared roster persistence', () => {
  it('should publish the folders recovered from sectionId as the shared layout', async () => {
    const engine = engineDouble()
    const firstRun = await readRoster(backendFor(engine))
    expect(hasSharedLayout(firstRun)).toBe(false)
    await publishRecoveredLayout(backendFor(engine), firstRun)
    expect(engine.metadata.default['talyx-folders']).toEqual([{ id: 'team', name: 'Team' }])
    expect(hasSharedLayout(await readRoster(backendFor(engine)))).toBe(true)
  })
  it('should prefer a shared layout over folders recovered from sectionId', async () => {
    const engine = engineDouble()
    engine.metadata.default['talyx-folders'] = [{ id: 'empty', name: 'Empty folder' }]
    expect((await readRoster(backendFor(engine))).folders).toEqual([
      { id: 'empty', name: 'Empty folder' }
    ])
  })
  it('should keep pin and nested folder changes when another client reloads', async () => {
    const engine = engineDouble()
    const initial = await readRoster(backendFor(engine))
    expect(initial.folders).toEqual([{ id: 'team', name: 'Team' }])
    await saveBotMeta(backendFor(engine), 'analyst', { pinned: true, pinnedOrder: 2 })
    await saveFolders(
      backendFor(engine),
      (folders) =>
        moveFolder([...folders, { id: 'projects', name: 'Projects' }], 'team', 'projects'),
      initial.folders
    )
    const otherClient = await readRoster(backendFor(engine))
    expect(otherClient.bots.find((bot) => bot.name === 'analyst')?.ui_meta?.[BOT_META_KEY]).toEqual(
      {
        title: 'Analyst',
        sectionId: 'team',
        sectionName: 'Team',
        color: 4,
        pinned: true,
        pinnedOrder: 2
      }
    )
    expect(otherClient.folders).toEqual([
      { id: 'team', name: 'Team', parentId: 'projects' },
      { id: 'projects', name: 'Projects' }
    ])
    expect(otherClient.rooms[0].room_id).toBe('room')
  })
  it('should retry a concurrent write while preserving the other client’s title', async () => {
    const engine = engineDouble()
    engine.conflictOnce()
    await saveBotMeta(backendFor(engine), 'analyst', { pinned: true })
    expect(engine.metadata.analyst[BOT_META_KEY]).toMatchObject({
      title: 'Renamed elsewhere',
      pinned: true,
      color: 4
    })
  })
  it('should not treat a rejected write as successful', async () => {
    const engine = engineDouble()
    const request: RosterRequest = (profile, method, params) =>
      method === 'profiles.configure'
        ? Promise.resolve({ applied: { ui_meta: false } })
        : engine.request(profile, method, params)
    await expect(saveBotMeta(backendFor({ request }), 'analyst', { hidden: true })).rejects.toThrow(
      'roster.errorNotSaved'
    )
    expect(engine.metadata.analyst[BOT_META_KEY]).not.toHaveProperty('hidden')
  })
  it('should fail visibly on malformed profile replies and invalid room pagination', async () => {
    await expect(
      readRoster(backendFor({ request: async () => ({ profiles: [{ name: 10 }] }) }))
    ).rejects.toThrow()
    const engine = engineDouble()
    const request: RosterRequest = (profile, method, params) =>
      method === 'groups.list'
        ? Promise.resolve({ rooms: [], next_offset: 0 })
        : engine.request(profile, method, params)
    await expect(readRoster(backendFor({ request }))).rejects.toThrow('roster.errorRoomCursor')
  })
  it('should keep the roster and the valid fields when another client wrote a bad field', async () => {
    const engine = engineDouble({
      default: { 'talyx-room-folders': 'not a map' },
      analyst: { [BOT_META_KEY]: { title: null, pinned: true, sectionId: 'team' } },
      writer: { [BOT_META_KEY]: 'not an object' }
    })
    const roster = await readRoster(backendFor(engine))
    expect(roster.bots.find((bot) => bot.name === 'analyst')?.meta).toEqual({
      pinned: true,
      sectionId: 'team'
    })
    expect(roster.bots.find((bot) => bot.name === 'writer')?.meta).toEqual({})
    expect(roster.roomFolders).toEqual({})
    await saveBotMeta(backendFor(engine), 'writer', { hidden: true })
    expect(engine.metadata.writer[BOT_META_KEY]).toEqual({ hidden: true })
  })
})
