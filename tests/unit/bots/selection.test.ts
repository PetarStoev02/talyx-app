import { beforeEach, describe, expect, it } from 'vitest'
import { useRoster } from '../../../src/renderer/src/features/bots/store'

beforeEach(() =>
  useRoster.setState({ selection: null, unread: {}, activity: {}, editingProfile: null })
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
})
