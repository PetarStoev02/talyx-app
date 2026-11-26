import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  botPreview,
  botTitle,
  childFolders,
  folderBots,
  folderCount,
  moveFolder,
  normalizeFolders,
  pinnedBots,
  placeKey,
  recoverFolders,
  startSelection,
  stepChat,
  timeInWords
} from '../../../src/renderer/src/features/bots/roster'
import { t } from '../../../src/renderer/src/shared/lib/i18n'
import type { Bot, Folder, RosterSnapshot } from '../../../src/renderer/src/features/bots/types'

const bot = (name: string, meta: Record<string, unknown> = {}): Bot => ({
  name,
  meta
})
const snapshot = (bots: Bot[]): RosterSnapshot => ({
  bots,
  rooms: [],
  folders: [{ id: 'team', name: 'Team' }],
  roomFolders: {},
  roomPins: [],
  itemOrder: {}
})

describe('roster layout', () => {
  it('should nest only subfolders under a folder and no folder under Unassigned', () => {
    const top: Folder = { id: 'team', name: 'Team', parentId: null }
    const sub: Folder = { id: 'sub', name: 'Sub', parentId: 'team' }
    expect(childFolders([top, sub], 'team')).toEqual([sub])
    expect(childFolders([top, sub], null)).toEqual([])
  })
  it('should keep a pinned bot out of its folder and restore it when unpinned', () => {
    const item = bot('worker', { pinned: true, sectionId: 'team' })
    expect(folderBots(snapshot([item]), 'team')).toEqual([])
    expect(pinnedBots([item])).toEqual([item])
    const unpinned = bot('worker', { pinned: false, sectionId: 'team' })
    expect(folderBots(snapshot([unpinned]), 'team')).toEqual([unpinned])
  })
  it('should order pins explicitly, then by activity and name, excluding hidden bots', () => {
    const first = bot('first', { pinned: true, pinnedOrder: 0 })
    const next = bot('next', { pinned: true, pinnedOrder: 1 })
    const recent = { ...bot('recent', { pinned: true }), last_session: { last_active: 100 } }
    expect(
      pinnedBots([bot('hidden', { pinned: true, hidden: true }), recent, next, first])
    ).toEqual([first, next, recent])
  })
  it('should count a folder with its subfolders and leave pinned bots out', () => {
    const nested: RosterSnapshot = {
      ...snapshot([
        bot('a', { sectionId: 'team' }),
        bot('b', { sectionId: 'sub' }),
        bot('c', { sectionId: 'sub', pinned: true }),
        bot('d')
      ]),
      folders: [
        { id: 'team', name: 'Team' },
        { id: 'sub', name: 'Sub', parentId: 'team' }
      ]
    }
    expect(folderCount(nested, 'team')).toBe(2)
    expect(folderCount(nested, 'sub')).toBe(1)
    expect(folderCount(nested, null)).toBe(1)
  })
  it("should count a folder's rooms with its bots, as the rows under it show", () => {
    const withRooms: RosterSnapshot = {
      ...snapshot([bot('a', { sectionId: 'team' })]),
      folders: [{ id: 'team', name: 'Team' }],
      rooms: [
        { room_id: 'r1', name: 'One', members: [] },
        { room_id: 'r2', name: 'Two', members: [] },
        { room_id: 'r3', name: 'Pinned', members: [] }
      ],
      roomFolders: { r1: 'team', r2: null, r3: 'team' },
      roomPins: ['r3']
    }
    expect(folderCount(withRooms, 'team')).toBe(2)
    expect(folderCount(withRooms, null)).toBe(1)
  })
  it('should put orphaned membership in Unassigned without showing hidden bots', () => {
    const orphan = bot('orphan', { sectionId: 'missing' })
    expect(folderBots(snapshot([orphan, bot('hidden', { hidden: true })]), null)).toEqual([orphan])
  })
  it('should recover shared folder ids once, retaining their carried names', () => {
    expect(
      recoverFolders([
        bot('a', { sectionId: 'team', sectionName: 'Team' }),
        bot('b', { sectionId: 'team', sectionName: 'Team' })
      ])
    ).toEqual([{ id: 'team', name: 'Team', parentId: null }])
  })
  it('should repair malformed, duplicate, orphaned and cyclic folders', () => {
    expect(
      normalizeFolders([
        null,
        {},
        { id: 'a', name: 'A', parentId: 'b' },
        { id: 'b', name: 'B', parentId: 'a' },
        { id: 'a', name: 'duplicate' },
        { id: 'c', name: 'C', parentId: 'absent' }
      ])
    ).toEqual([
      { id: 'a', name: 'A', parentId: null },
      { id: 'b', name: 'B', parentId: 'a' },
      { id: 'c', name: 'C', parentId: null }
    ])
  })
  it('should reject nesting a folder in its own descendant', () => {
    const folders = [
      { id: 'a', name: 'A', parentId: null },
      { id: 'b', name: 'B', parentId: 'a' }
    ]
    expect(() => moveFolder(folders, 'a', 'b')).toThrow('roster.errorFolderCycle')
    expect(moveFolder(folders, 'b', null)).toEqual([
      { id: 'a', name: 'A', parentId: null },
      { id: 'b', name: 'B', parentId: null }
    ])
    expect(folders[1].parentId).toBe('a')
  })
  it.each([
    ['in front of an item', 'c', 'a', ['c', 'a', 'b']],
    ['to the end', 'a', null, ['b', 'c', 'a']],
    ['to the end when the item in front is gone', 'a', 'x', ['b', 'c', 'a']],
    ['into a list it was not in', 'd', 'b', ['a', 'd', 'b', 'c']]
  ])('should place a key %s', (_case, key, before, expected) => {
    expect(placeKey(['a', 'b', 'c'], key, before)).toEqual(expected)
  })
})

const english = (key: Parameters<typeof t>[0]): string => t(key, 'en')

describe('roster previews', () => {
  // Before the engine reports Talyx's handle: previews stay as written.
  const manager = { handle: null, name: 'Talyx' }
  it('should call the default profile Talyx regardless of its stored title', () => {
    expect(botTitle(bot('default', { title: 'Old name' }))).toBe('Talyx')
  })
  it('should prefer canonical chat preview, then recent session, then description', () => {
    expect(
      botPreview(
        {
          ...bot('a'),
          canonical_session: { preview: 'Canonical' },
          last_session: { preview: 'Recent' }
        },
        english,
        manager
      )
    ).toBe('Canonical')
    expect(botPreview({ ...bot('a'), last_session: { preview: 'Recent' } }, english, manager)).toBe(
      'Recent'
    )
    expect(botPreview(bot('a', { description: 'Analyst' }), english, manager)).toBe('Analyst')
    expect(botPreview(bot('a'), english, manager)).toBe('')
  })

  it("should show a message another bot delivered as its words, without the engine's wrapper", () => {
    const delivered = { preview: 'Message from 🤖 manager (@manager): Check cash' }
    expect(botPreview({ ...bot('a'), canonical_session: delivered }, english, manager)).toBe(
      'Check cash'
    )
  })

  it("should show Talyx's name where a preview has the engine's handle for it", () => {
    const named = { handle: 'acme', name: 'Talyx' }
    const reply = { ...bot('a'), canonical_session: { preview: '@acme got the status.' } }
    const delivered = { preview: 'Message from 🤖 CFO (@cfo): @acme check cash' }
    expect(botPreview(reply, english, named)).toBe('@Talyx got the status.')
    expect(botPreview({ ...bot('a'), canonical_session: delivered }, english, named)).toBe(
      '@Talyx check cash'
    )
  })

  // The engine cuts a preview at 60 characters and ends it with three dots.
  it.each([
    ['inside the sender', 'Message from 🤖 Agro Ops Chief Financial Officer (@agro-ops-c...'],
    ['before the words begin', 'Message from 🤖 Agro Ops Finance Lead (@agro-ops-finance): ...']
  ])("should fall back to the bot's description when the cut is %s", (_, preview) => {
    const cut = { ...bot('a', { description: 'Analyst' }), last_session: { preview } }
    expect(botPreview(cut, english, manager)).toBe('Analyst')
  })

  it.each([
    [
      'Your request was not processed. Send it again if you still want me to carry it o...',
      'Last reply did not finish'
    ],
    [
      'This turn did not complete. Some actions may already have run; verify their e...',
      'Last reply did not finish'
    ],
    [
      'An automated delivery was interrupted and was not run again. Some actions ma...',
      'Last reply did not finish'
    ],
    ['(empty)', 'Ended without a reply']
  ])("should never show the engine's words for a turn without an answer: %s", (preview, shown) => {
    expect(botPreview({ ...bot('a'), canonical_session: { preview } }, english, manager)).toBe(
      shown
    )
  })
  it('should render engine timestamps in seconds as words without negative ages', () => {
    expect(timeInWords(100, english, 160000)).toBe('1 minute ago')
    expect(timeInWords(100, english, 7300000)).toBe('2 hours ago')
    expect(timeInWords(100, english, 864100000)).toBe('10 days ago')
    expect(timeInWords(200, english, 100000)).toBe('just now')
    expect(timeInWords(0, english)).toBe('')
  })
})

describe('the chat the Agents page opens', () => {
  const roster = (bots: Bot[], roomIds: string[] = []): RosterSnapshot => ({
    ...snapshot(bots),
    rooms: roomIds.map((room_id) => ({ room_id, name: room_id, members: [] }))
  })
  const bots = [bot('default'), bot('analyst'), bot('ghost', { hidden: true })]

  it.each([
    ['the saved bot', { kind: 'bot', id: 'analyst' }, { kind: 'bot', id: 'analyst' }],
    ['the saved room', { kind: 'room', id: 'team' }, { kind: 'room', id: 'team' }],
    [
      'Talyx when the saved bot is gone',
      { kind: 'bot', id: 'deleted' },
      { kind: 'bot', id: 'default' }
    ],
    [
      'Talyx when the saved bot is hidden',
      { kind: 'bot', id: 'ghost' },
      { kind: 'bot', id: 'default' }
    ],
    [
      'Talyx when the saved room is gone',
      { kind: 'room', id: 'gone' },
      { kind: 'bot', id: 'default' }
    ],
    ['Talyx on a first run', null, { kind: 'bot', id: 'default' }]
  ] as const)('should open %s', (_case, saved, expected) => {
    expect(startSelection(roster(bots, ['team']), saved)).toEqual(expected)
  })

  it('should always open a chat the roster shows while it shows any bot, whatever was saved', () => {
    const NAMES = ['default', 'analyst', 'writer']
    const shownBots = fc.uniqueArray(
      fc.record({ name: fc.constantFrom(...NAMES), hidden: fc.boolean() }),
      { selector: (row) => row.name }
    )
    const roomIds = fc.uniqueArray(fc.constantFrom('team', 'ops'))
    const id = fc.constantFrom(...NAMES, 'team', 'ops', 'gone')
    const saved = fc.option(fc.record({ kind: fc.constantFrom('bot', 'room'), id }), {
      nil: null
    })
    fc.assert(
      fc.property(shownBots, roomIds, saved, (rows, rooms, pick) => {
        const shown = roster(
          rows.map((row) => bot(row.name, { hidden: row.hidden })),
          rooms
        )
        const opened = startSelection(shown, pick)
        const visible = rows.filter((row) => !row.hidden).map((row) => row.name)
        if (visible.length === 0) return
        const open =
          opened?.kind === 'bot' ? visible.includes(opened.id) : rooms.includes(opened?.id ?? '')
        expect(open).toBe(true)
      })
    )
  })

  it('should open another bot when Talyx is not in the roster, and nothing when no bot is', () => {
    expect(startSelection(roster([bot('analyst')]), null)).toEqual({ kind: 'bot', id: 'analyst' })
    expect(startSelection(roster([]), null)).toBeNull()
  })
})

describe('switching chats', () => {
  const shown = ['bot:talyx', 'folder:work', 'bot:writer', 'room:standup']

  it.each([
    ['the next chat', 'bot:talyx', 1, 'bot:writer'],
    ['the previous chat', 'room:standup', -1, 'bot:writer'],
    ['past a folder row', 'bot:writer', -1, 'bot:talyx'],
    ['down with nothing open, the first chat', null, 1, 'bot:talyx'],
    ['up with nothing open, the last chat', null, -1, 'room:standup'],
    ['down from a chat in a closed folder, the first chat', 'bot:hidden', 1, 'bot:talyx'],
    ['down from the last chat, nothing', 'room:standup', 1, null],
    ['up from the first chat, nothing', 'bot:talyx', -1, null]
  ] as const)('should go to %s', (_case, open, step, expected) => {
    expect(stepChat(shown, open, step)).toBe(expected)
  })

  it('should go nowhere with no chats', () => {
    expect(stepChat(['folder:work'], null, 1)).toBeNull()
  })
})

describe('normalizeFolders, for any stored folder layout', () => {
  // A few ids, with stray spaces, so parents point at each other, at themselves and in loops.
  const id = fc.constantFrom('a', 'b', 'c', 'd', ' a', 'b ', '', '  ')
  const entry = fc.oneof(
    {
      weight: 5,
      arbitrary: fc.record({ id, name: fc.constantFrom('Team', ' Ops', ''), parentId: id })
    },
    { weight: 2, arbitrary: fc.record({ id, name: fc.constant('Team') }) },
    fc.record({ id: fc.anything(), name: fc.anything(), parentId: fc.anything() }),
    fc.anything()
  )
  const stored = fc.oneof(
    { weight: 5, arbitrary: fc.array(entry, { maxLength: 12 }) },
    fc.anything()
  )

  // The roster's own walk (Roster.tsx, FolderGroup.tsx): top-level folders, then each one's
  // children. A loop would never end, so it stops past the folder count and reports what it saw.
  function rendered(folders: Folder[]): string[] {
    const seen: string[] = []
    const visit = (folder: Folder): void => {
      if (seen.length > folders.length) return
      seen.push(folder.id)
      for (const child of folders.filter((item) => item.parentId === folder.id)) visit(child)
    }
    for (const top of folders.filter((folder) => !folder.parentId)) visit(top)
    return seen
  }

  function storedIds(value: unknown): string[] {
    if (!Array.isArray(value)) return []
    const ids = (value as unknown[]).flatMap((item) => {
      const { id, name } = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
      return typeof id === 'string' && id.trim() && typeof name === 'string' && name.trim()
        ? [id.trim()]
        : []
    })
    return [...new Set(ids)]
  }

  it('should never let malformed parents hide a folder or loop rendering', () => {
    fc.assert(
      fc.property(stored, (value) => {
        const folders = normalizeFolders(value)
        expect(folders.map((folder) => folder.id)).toEqual(storedIds(value))
        expect(rendered(folders).sort()).toEqual(folders.map((folder) => folder.id).sort())
      })
    )
  })
})
