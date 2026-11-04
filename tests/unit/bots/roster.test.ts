import { describe, expect, it } from 'vitest'
import {
  botPreview,
  botTitle,
  folderBots,
  folderCount,
  moveFolder,
  normalizeFolders,
  pinnedBots,
  recoverFolders,
  reorder,
  timeInWords
} from '../../../src/renderer/src/features/bots/roster'
import { t } from '../../../src/renderer/src/shared/lib/i18n'
import type { Bot, RosterSnapshot } from '../../../src/renderer/src/features/bots/types'

const bot = (name: string, meta: Record<string, unknown> = {}): Bot => ({
  name,
  meta
})
const snapshot = (bots: Bot[]): RosterSnapshot => ({
  bots,
  rooms: [],
  folders: [{ id: 'team', name: 'Team' }],
  roomFolders: {},
  roomPins: []
})

describe('roster layout', () => {
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
    ).toEqual([{ id: 'team', name: 'Team' }])
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
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B', parentId: 'a' },
      { id: 'c', name: 'C' }
    ])
  })
  it('should reject nesting a folder in its own descendant', () => {
    const folders = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B', parentId: 'a' }
    ]
    expect(() => moveFolder(folders, 'a', 'b')).toThrow('roster.errorFolderCycle')
    expect(moveFolder(folders, 'b', null)).toEqual([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' }
    ])
    expect(folders[1].parentId).toBe('a')
  })
  it('should reorder without mutating and ignore an unknown drag source', () => {
    const values = ['a', 'b', 'c']
    expect(reorder(values, 0, 2)).toEqual(['b', 'c', 'a'])
    expect(reorder(values, -1, 0)).toEqual(values)
    expect(values).toEqual(['a', 'b', 'c'])
  })
})

const english = (key: Parameters<typeof t>[0]): string => t(key, 'en')

describe('roster previews', () => {
  it('should call the default profile Talyx regardless of its stored title', () => {
    expect(botTitle(bot('default', { title: 'Old name' }))).toBe('Talyx')
  })
  it('should prefer canonical chat preview, then recent session, then description', () => {
    expect(
      botPreview({
        ...bot('a'),
        canonical_session: { preview: 'Canonical' },
        last_session: { preview: 'Recent' }
      })
    ).toBe('Canonical')
    expect(botPreview({ ...bot('a'), last_session: { preview: 'Recent' } })).toBe('Recent')
    expect(botPreview(bot('a', { description: 'Analyst' }))).toBe('Analyst')
    expect(botPreview(bot('a'))).toBe('')
  })
  it('should render engine timestamps in seconds as words without negative ages', () => {
    expect(timeInWords(100, english, 160000)).toBe('1 minute ago')
    expect(timeInWords(100, english, 7300000)).toBe('2 hours ago')
    expect(timeInWords(100, english, 864100000)).toBe('10 days ago')
    expect(timeInWords(200, english, 100000)).toBe('just now')
    expect(timeInWords(0, english)).toBe('')
  })
})
