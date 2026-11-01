import { describe, it, expect } from 'vitest'
import {
  groupSendBlocker,
  isTextEntry,
  NO_RELAY_HINT
} from '../../../src/renderer/src/features/chat/chatRules'

describe('groupSendBlocker', () => {
  const bots = [
    { id: 'ready', webhookReady: true },
    { id: 'cold', webhookReady: false }
  ]

  it('should block a group without a relay bot', () => {
    expect(groupSendBlocker({ relayBotId: null }, bots)).toBe(NO_RELAY_HINT)
  })

  it('should block a group whose relay bot has no webhook', () => {
    expect(groupSendBlocker({ relayBotId: 'cold' }, bots)).toBe(NO_RELAY_HINT)
  })

  it('should allow a group whose relay bot is ready', () => {
    expect(groupSendBlocker({ relayBotId: 'ready' }, bots)).toBeNull()
  })
})

describe('isTextEntry', () => {
  it('should recognise a textarea and an input', () => {
    expect(isTextEntry({ tagName: 'TEXTAREA' } as unknown as EventTarget)).toBe(true)
    expect(isTextEntry({ tagName: 'INPUT' } as unknown as EventTarget)).toBe(true)
  })

  it('should not treat other targets as text entry', () => {
    expect(isTextEntry({ tagName: 'DIV' } as unknown as EventTarget)).toBe(false)
    expect(isTextEntry(null)).toBe(false)
  })
})
