import { beforeEach, describe, expect, it, vi } from 'vitest'

const saved = vi.hoisted(() => ({ completionSound: false }))
vi.mock('@shared/lib/chime', () => ({ playChime: vi.fn() }))
vi.mock('@shared/api/ipc', () => ({
  settingsApi: {
    get: async () => ({ ...saved }),
    set: async (partial: { completionSound?: boolean }) => Object.assign(saved, partial)
  }
}))

import { chatActions } from '../../../src/renderer/src/features/chat/chat'
import type { ChatActions } from '../../../src/renderer/src/features/chat/chat'
import { useCompletionSound } from '../../../src/renderer/src/features/chat/completionSound'
import { handleEvent } from '../../../src/renderer/src/features/chat/events'
import { roomActions } from '../../../src/renderer/src/features/chat/room'
import type { RoomActions } from '../../../src/renderer/src/features/chat/room'
import { useRooms } from '../../../src/renderer/src/features/chat/roomStore'
import { useChat } from '../../../src/renderer/src/features/chat/store'
import { playChime } from '../../../src/renderer/src/shared/lib/chime'
import type { GatewayEvent } from '../../../src/renderer/src/shared/engine/shared'
import { chatDouble } from './chatDouble'
import { ROOM, roomDouble } from './roomDouble'
import type { RoomDouble } from './roomDouble'

const WORKER = 'acme-worker'

const event = (type: string, seq: number, payload: Record<string, unknown> = {}): GatewayEvent =>
  ({ type, payload, session_id: 'worker-chat', seq }) as GatewayEvent

const reply = (status: string | null, seq = 11): void => {
  handleEvent(chat, event('message.start', seq - 1))
  handleEvent(
    chat,
    event('message.complete', seq, status ? { text: 'Done', status } : { text: 'Done' })
  )
}

let chat: ChatActions

beforeEach(async () => {
  vi.mocked(playChime).mockClear()
  saved.completionSound = false
  useCompletionSound.setState({ enabled: false })
  useChat.setState({ chats: {} })
  chat = chatActions(chatDouble({ [WORKER]: { sessionId: 'worker-chat', messages: [] } }).backend)
  await chat.open(WORKER, 'worker-chat')
})

describe('completion sound', () => {
  describe('setting', () => {
    it('should be off until the user turns it on', async () => {
      await useCompletionSound.getState().load()
      expect(useCompletionSound.getState().enabled).toBe(false)
    })

    it('should save the choice so the next launch reads it back', async () => {
      await useCompletionSound.getState().setEnabled(true)
      useCompletionSound.setState({ enabled: false })
      await useCompletionSound.getState().load()
      expect(useCompletionSound.getState().enabled).toBe(true)
    })
  })

  describe('a bot chat', () => {
    it('should chime once when a bot finishes a reply and the sound is on', () => {
      useCompletionSound.setState({ enabled: true })
      reply('complete')
      expect(playChime).toHaveBeenCalledTimes(1)
    })

    it('should stay silent when the sound is off', () => {
      reply('complete')
      expect(playChime).not.toHaveBeenCalled()
    })

    it.each(['interrupted', 'error', null])('should stay silent for a %s turn', (status) => {
      useCompletionSound.setState({ enabled: true })
      reply(status)
      expect(playChime).not.toHaveBeenCalled()
    })

    it('should stay silent for streaming, tool steps and a repeated completion', () => {
      useCompletionSound.setState({ enabled: true })
      handleEvent(chat, event('message.start', 10))
      handleEvent(chat, event('message.delta', 11, { text: 'Work' }))
      handleEvent(chat, event('tool.start', 12, { tool_id: 't1', name: 'search' }))
      handleEvent(chat, event('tool.complete', 13, { tool_id: 't1' }))
      expect(playChime).not.toHaveBeenCalled()
      handleEvent(chat, event('message.complete', 14, { text: 'Done', status: 'complete' }))
      handleEvent(chat, event('message.complete', 14, { text: 'Done', status: 'complete' }))
      expect(playChime).toHaveBeenCalledTimes(1)
    })
  })

  describe('a group room', () => {
    let engine: RoomDouble
    let room: RoomActions

    beforeEach(async () => {
      useRooms.setState({ rooms: {} })
      engine = roomDouble([])
      room = roomActions(engine.backend)
      useCompletionSound.setState({ enabled: true })
    })

    it('should chime once per poll that brings a member reply, not for the history', async () => {
      engine.memberSays('acme-cfo', 'Earlier answer.')
      await room.refresh(ROOM)
      expect(playChime).not.toHaveBeenCalled()
      engine.memberSays('acme-cfo', 'Yearly.')
      engine.memberSays('default', 'Agreed.')
      await room.refresh(ROOM)
      await room.refresh(ROOM)
      expect(playChime).toHaveBeenCalledTimes(1)
    })

    it('should stay silent for the user own message in a room already read', async () => {
      engine.memberSays('acme-cfo', 'Earlier answer.')
      await room.refresh(ROOM)
      await room.send(ROOM, { text: 'Monthly or yearly?', attachments: [] })
      await room.refresh(ROOM)
      expect(playChime).not.toHaveBeenCalled()
    })
  })
})
