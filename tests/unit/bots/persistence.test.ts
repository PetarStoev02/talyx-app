import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  hasSharedLayout,
  publishRecoveredLayout,
  readRoster,
  saveBotMeta,
  saveFolders
} from '../../../src/renderer/src/features/bots/data'
import {
  FOLDERS_KEY,
  ITEM_ORDER_KEY,
  NO_META,
  ROOM_FOLDERS_KEY,
  ROOM_PINS_KEY,
  moveFolder
} from '../../../src/renderer/src/features/bots/roster'
import { BOT_META_KEY, GROUPS_META_KEY, backendFor, engineDouble } from './engineDouble'
import type { EngineDouble, EngineRequest } from './engineDouble'
import { lookMeta } from '../../../src/renderer/src/features/bots/look'
import type { BotMeta, Room } from '../../../src/renderer/src/features/bots/types'

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
      { id: 'empty', name: 'Empty folder', parentId: null }
    ])
  })
  it('should keep pin and nested folder changes when another client reloads', async () => {
    const engine = engineDouble()
    const initial = await readRoster(backendFor(engine))
    expect(initial.folders).toEqual([{ id: 'team', name: 'Team', parentId: null }])
    await saveBotMeta(backendFor(engine), 'analyst', { pinned: true, pinnedOrder: 2 })
    await saveFolders(
      backendFor(engine),
      (folders) =>
        moveFolder(
          [...folders, { id: 'projects', name: 'Projects', parentId: null }],
          'team',
          'projects'
        ),
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
      { id: 'projects', name: 'Projects', parentId: null }
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
    const request: EngineRequest = (profile, method, params) =>
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
    const request: EngineRequest = (profile, method, params) =>
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
      ...NO_META,
      pinned: true,
      sectionId: 'team'
    })
    expect(roster.bots.find((bot) => bot.name === 'writer')?.meta).toEqual(NO_META)
    expect(roster.roomFolders).toEqual({})
    await saveBotMeta(backendFor(engine), 'writer', { hidden: true })
    expect(engine.metadata.writer[BOT_META_KEY]).toEqual({ hidden: true })
  })
  it('should drop a bad field, never the whole roster, whatever other clients wrote', async () => {
    const text = (value: unknown): boolean => typeof value === 'string'
    const flag = (value: unknown): boolean => typeof value === 'boolean'
    const count = (value: unknown): boolean => Number.isFinite(value)
    const textOrNull = (value: unknown): boolean => value === null || text(value)
    // Each field of a bot's record and the type Talyx reads it as.
    const FIELDS: Record<string, (value: unknown) => boolean> = {
      title: text,
      description: text,
      sectionId: textOrNull,
      sectionName: textOrNull,
      pinned: flag,
      pinnedOrder: count,
      hidden: flag,
      shape: text,
      color: (value) => count(value) || text(value),
      faces: flag,
      usesDefault: flag
    }
    const fields = fc.record(
      Object.fromEntries(Object.keys(FIELDS).map((field) => [field, fc.jsonValue()])),
      { requiredKeys: [] }
    )
    const record = fc.oneof(fields, fc.jsonValue())
    const layout = fc.record(
      Object.fromEntries(
        [FOLDERS_KEY, ROOM_FOLDERS_KEY, ROOM_PINS_KEY, ITEM_ORDER_KEY, GROUPS_META_KEY].map(
          (key) => [key, fc.jsonValue()]
        )
      ),
      { requiredKeys: [] }
    )
    // What the engine lists of a profile, as clients set it.
    const profile = fc.record(
      Object.fromEntries(
        ['display_name', 'title', 'description', 'canonical_session', 'last_session'].map((key) => [
          key,
          fc.jsonValue()
        ])
      ),
      { requiredKeys: [] }
    )
    await fc.assert(
      fc.asyncProperty(layout, record, record, profile, async (shared, analyst, writer, row) => {
        const engine = engineDouble({
          default: shared,
          analyst: { [BOT_META_KEY]: analyst },
          writer: { [BOT_META_KEY]: writer }
        })
        const request: EngineRequest = async (name, method, params) => {
          const answer = await engine.request(name, method, params)
          if (method !== 'profiles.list') return answer
          const { profiles } = answer as { profiles: Record<string, unknown>[] }
          return { profiles: profiles.map((listed) => ({ ...listed, ...row })) }
        }
        const { bots } = await readRoster(backendFor({ request }))
        expect(bots.map((bot) => bot.name)).toEqual(['default', 'analyst', 'writer'])
        for (const [bot, written] of [
          [bots[1], analyst],
          [bots[2], writer]
        ] as const) {
          const stored = (written ?? {}) as Record<string, unknown>
          for (const [field, readable] of Object.entries(FIELDS)) {
            if (readable(stored[field])) expect(bot.meta).toHaveProperty(field, stored[field])
            else expect(bot.meta[field as keyof typeof bot.meta]).toBeNull()
          }
        }
      })
    )
  })
})

describe('the records as the engine receives them', () => {
  const STORED = {
    title: 'Analyst',
    description: 'Old',
    sectionId: 'team',
    sectionName: 'Team',
    color: 4,
    usesDefault: true,
    faces: false
  }

  // The JSON of each profiles.configure call, as the socket sends it.
  const recording = (
    engine: EngineDouble
  ): { request: EngineRequest; sent: Record<string, unknown>[] } => {
    const sent: Record<string, unknown>[] = []
    const request: EngineRequest = (profile, method, params) => {
      if (method === 'profiles.configure') sent.push(JSON.parse(JSON.stringify(params)))
      return engine.request(profile, method, params)
    }
    return { request, sent }
  }

  const botRecordAfter = async (patch: Partial<BotMeta>): Promise<string> => {
    const engine = engineDouble({ default: {}, analyst: { [BOT_META_KEY]: STORED } })
    const { request, sent } = recording(engine)
    await saveBotMeta(backendFor({ request }), 'analyst', patch)
    return JSON.stringify((sent[0].ui_meta as Record<string, unknown>)[BOT_META_KEY])
  }

  it.each<[string, Partial<BotMeta>, Record<string, unknown>]>([
    ["stops following Talyx's model", { usesDefault: null }, { ...STORED, usesDefault: undefined }],
    ["follows Talyx's model", { usesDefault: true }, STORED],
    [
      "drops an older client's description",
      { description: null },
      { ...STORED, description: undefined }
    ],
    [
      'turns its face back on',
      lookMeta({ shape: 'tower', hue: 7, faces: true }),
      { ...STORED, color: 7, faces: undefined, shape: 'tower' }
    ],
    [
      'turns its face off',
      lookMeta({ shape: 'tower', hue: 7, faces: false }),
      { ...STORED, color: 7, shape: 'tower' }
    ],
    [
      'moves to Unassigned',
      { pinned: false, sectionId: null, sectionName: null },
      { ...STORED, sectionId: null, sectionName: null, pinned: false }
    ],
    ['is pinned', { pinned: true, pinnedOrder: 3 }, { ...STORED, pinned: true, pinnedOrder: 3 }],
    ['is unpinned', { pinned: false }, { ...STORED, pinned: false }],
    ['is hidden', { hidden: true }, { ...STORED, hidden: true }],
    ['is renamed', { title: 'Lead' }, { ...STORED, title: 'Lead' }]
  ])(
    'should send the bot record with a null field removed and a null section kept when the bot %s',
    async (_change, patch, record) => {
      expect(await botRecordAfter(patch)).toBe(JSON.stringify(record))
    }
  )

  it('should store a top-level folder without a parentId and a nested one with it', async () => {
    const engine = engineDouble()
    const { request, sent } = recording(engine)
    const { folders } = await readRoster(backendFor(engine))
    await saveFolders(
      backendFor({ request }),
      (value) => [...value, { id: 'clients', name: 'Clients', parentId: 'team' }],
      folders
    )
    expect(JSON.stringify((sent[0].ui_meta as Record<string, unknown>)[FOLDERS_KEY])).toBe(
      '[{"id":"team","name":"Team"},{"id":"clients","name":"Clients","parentId":"team"}]'
    )
  })

  it('should read a field another client left out or wrote wrong as null', async () => {
    const engine = engineDouble(
      { default: {}, analyst: { [BOT_META_KEY]: { title: 7, pinned: true } } },
      [
        {
          room_id: 'room',
          name: 'Team room',
          members: [{ profile: 'analyst' }],
          latest_seq: -1
        } as unknown as Room
      ]
    )
    const roster = await readRoster(backendFor(engine))
    const analyst = roster.bots.find((bot) => bot.name === 'analyst')
    expect(analyst).toMatchObject({
      meta: { ...NO_META, pinned: true },
      display_name: null,
      canonical_session: null,
      last_session: null
    })
    expect(roster.rooms).toEqual([
      {
        room_id: 'room',
        name: 'Team room',
        members: [{ profile: 'analyst', member_id: null, handle: null, display_name: null }],
        disbanded_at: null,
        latest_seq: null
      }
    ])
  })
})

describe('saving the layout over a fake backend', () => {
  const TEAM = { id: 'team', name: 'Team' }
  const CLIENTS = { id: 'clients', name: 'Clients' }

  const written = async (stored: Record<string, unknown>): Promise<Record<string, unknown>> => {
    let changes: Record<string, unknown> = {}
    await saveFolders(
      { updateLayout: async (update) => void (changes = update(stored)) },
      (folders) => [...folders, CLIENTS],
      [TEAM]
    )
    return changes
  }

  it('should change the stored folders and write only the folders', async () => {
    expect(
      await written({ [FOLDERS_KEY]: [{ id: 'empty', name: 'Empty' }], [ROOM_PINS_KEY]: ['x'] })
    ).toEqual({ [FOLDERS_KEY]: [{ id: 'empty', name: 'Empty' }, CLIENTS] })
  })

  it('should start from the fallback when no folders are stored', async () => {
    expect(await written({})).toEqual({ [FOLDERS_KEY]: [TEAM, CLIENTS] })
  })
})
