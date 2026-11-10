import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useRoster } from '../../../src/renderer/src/features/bots/store'
import { useChat } from '../../../src/renderer/src/features/chat/store'
import type { ChatActions } from '../../../src/renderer/src/features/chat/chat'
import { ModuleChatError, moduleChat } from '../../../src/renderer/src/app/providers/moduleChat'

const bot = (name: string, display_name?: string): object => ({ meta: {}, name, display_name })

describe('a module page talking to the bots', () => {
  let send: ReturnType<typeof vi.fn>
  let recent: ReturnType<typeof vi.fn>
  let open: ReturnType<typeof vi.fn>
  let connected: boolean
  const chat = moduleChat(() =>
    connected ? ({ send, recent, open } as unknown as ChatActions) : null
  )

  beforeEach(() => {
    connected = true
    send = vi.fn(async () => true)
    recent = vi.fn(async () => ['[run acme/api#7] step=plan'])
    open = vi.fn(async () => undefined)
    useRoster.setState({
      snapshot: {
        bots: [bot('default', 'Talyx'), bot('t3-tots', 'T3 Tots')],
        folders: [],
        rooms: [],
        roomFolders: {},
        roomPins: [],
        itemOrder: {}
      } as never
    })
    useChat.setState({ chats: {} } as never)
  })

  it('should list the bots by the names you know them by, marking Talyx', () => {
    expect(chat.bots()).toEqual([
      { id: 'default', name: 'Talyx', manager: true },
      { id: 't3-tots', name: 'T3 Tots', manager: false }
    ])
  })

  it("should send through the bot's chat, waiting behind a turn the bot is in", async () => {
    await chat.send('default', 'Start a Workflows run for acme/api#7')
    expect(send).toHaveBeenCalledWith('default', {
      text: 'Start a Workflows run for acme/api#7',
      images: [],
      whenBusy: 'queue'
    })
  })

  it("should find the bot's existing chat before the first send, and not again after", async () => {
    await chat.send('default', 'first')
    expect(open).toHaveBeenCalledWith('default', null)
    expect(open.mock.invocationCallOrder[0]).toBeLessThan(send.mock.invocationCallOrder[0])
    useChat.setState({ chats: { default: { sessionId: 's1' } } } as never)
    open.mockClear()
    await chat.send('default', 'second')
    expect(open).not.toHaveBeenCalled()
  })

  it('should read the bot’s newest replies, with the limit kept in bounds', async () => {
    expect(await chat.replies('t3-tots', 10_000)).toEqual(['[run acme/api#7] step=plan'])
    expect(recent).toHaveBeenCalledWith('t3-tots', 200)
  })

  it.each([
    [
      'a bot that does not exist',
      () => chat.send('nobody', 'hi'),
      'There is no bot named "nobody".'
    ],
    ['an empty message', () => chat.send('default', '  '), 'A message is 1 to 20000 characters.'],
    [
      'a message far too long',
      () => chat.send('default', 'x'.repeat(20_001)),
      'A message is 1 to 20000 characters.'
    ],
    [
      'replies from a bot that does not exist',
      () => chat.replies('nobody'),
      'There is no bot named "nobody".'
    ]
  ])('should refuse %s', async (_, act, message) => {
    await expect(act()).rejects.toThrow(new ModuleChatError(message))
    expect(send).not.toHaveBeenCalled()
  })

  it('should say the engine is not there yet instead of sending nowhere', async () => {
    connected = false
    await expect(chat.send('default', 'hi')).rejects.toThrow(
      'Talyx is not connected to its engine yet.'
    )
  })

  it("should pass on the chat's own reason when a send fails", async () => {
    send = vi.fn(async () => {
      useChat.setState({
        chats: { default: { error: { key: 'chat.errorSend', detail: 'The engine is busy' } } }
      } as never)
      return false
    })
    await expect(chat.send('default', 'hi')).rejects.toThrow(ModuleChatError)
  })
})
