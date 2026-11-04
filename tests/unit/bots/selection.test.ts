import { beforeEach, describe, expect, it } from 'vitest'
import { applySnapshot } from '../../../src/renderer/src/features/bots/actions'
import { botChatId } from '../../../src/renderer/src/features/bots/roster'
import { useRoster } from '../../../src/renderer/src/features/bots/store'
import type { Bot, RosterSnapshot } from '../../../src/renderer/src/features/bots/types'

const bot = (name: string, canonical: Bot['canonical_session'] = null): Bot => ({
  name,
  meta: {},
  canonical_session: canonical
})

const snapshotWith = (lastActive: Record<string, number>): RosterSnapshot => ({
  bots: Object.entries(lastActive).map(([name, last_active]) => bot(name, { last_active })),
  folders: [],
  rooms: [],
  roomFolders: {}
})

beforeEach(() =>
  useRoster.setState({ selection: null, unread: {}, activity: {}, editingProfile: null, seen: {} })
)
describe('roster selection and unread state', () => {
  it('should mark background replies unread and clear them when the bot opens', () => {
    useRoster.getState().markUnread('analyst')
    expect(useRoster.getState().unread.analyst).toBe(true)
    useRoster.getState().select({ kind: 'bot', id: 'analyst' })
    expect(useRoster.getState().unread.analyst).toBe(false)
    useRoster.getState().markUnread('analyst')
    expect(useRoster.getState().unread.analyst).toBe(false)
  })
  it('should keep room and bot identities distinct and close old details', () => {
    useRoster.setState({ editingProfile: 'analyst' })
    useRoster.getState().select({ kind: 'room', id: 'analyst' })
    useRoster.getState().markUnread('analyst')
    expect(useRoster.getState().unread.analyst).toBe(true)
    expect(useRoster.getState().editingProfile).toBeNull()
  })
  it('should not mark bots unread on the first snapshot', () => {
    applySnapshot(snapshotWith({ analyst: 100, default: 100 }))
    expect(useRoster.getState().unread).toEqual({})
  })
  it('should mark a bot unread when its chat moves while it is not selected', () => {
    applySnapshot(snapshotWith({ analyst: 100 }))
    applySnapshot(snapshotWith({ analyst: 200 }))
    expect(useRoster.getState().unread.analyst).toBe(true)
  })
  it('should not mark the selected bot unread', () => {
    useRoster.getState().select({ kind: 'bot', id: 'analyst' })
    applySnapshot(snapshotWith({ analyst: 100 }))
    applySnapshot(snapshotWith({ analyst: 200 }))
    expect(useRoster.getState().unread.analyst).toBe(false)
  })
  it('should read the chat id from the canonical session', () => {
    expect(botChatId(bot('a', { id: 'root', resolved_id: 'tip' }))).toBe('tip')
    expect(botChatId(bot('a', { id: 'root' }))).toBe('root')
    expect(botChatId(bot('a'))).toBeNull()
  })
})
