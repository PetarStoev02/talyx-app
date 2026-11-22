import { beforeEach, describe, expect, it, vi } from 'vitest'
import { botChatBackend } from '../../../src/renderer/src/app/providers/useMcpBridge'
import { mcpTools } from '../../../src/renderer/src/features/bots/mcp'
import type { ChatActions } from '../../../src/renderer/src/features/chat/chat'
import { useChat } from '../../../src/renderer/src/features/chat/store'
import type { McpAnswer } from '../../../src/shared/mcp'
import { backendFor, engineDouble } from '../bots/engineDouble'

// These tools show no interface.
const noSurface = { show: async (): Promise<boolean> => false }

describe("an agent talking to one bot through Talyx's MCP server", () => {
  let send: ReturnType<typeof vi.fn>
  let recent: ReturnType<typeof vi.fn>
  let open: ReturnType<typeof vi.fn>
  let call: (tool: string, args: unknown) => Promise<McpAnswer>

  beforeEach(() => {
    send = vi.fn(async () => true, noSurface)
    recent = vi.fn(async () => ['Cash is above the floor.'])
    open = vi.fn(async () => undefined)
    useChat.setState({ chats: {} } as never)
    const chat = { send, recent, open } as unknown as ChatActions
    // The roster of the bots' tests (Talyx and Analyst), with the app's own wiring to the chat.
    call = mcpTools(
      { ...backendFor(engineDouble()), ...botChatBackend(chat) },
      async () => true,
      noSurface
    )
  })

  it("should send in the bot's own chat, behind an answer the bot is giving", async () => {
    const answer = await call('send_bot_message', { profile: 'analyst', text: 'Check cash' })

    expect(answer).toEqual({ ok: true, text: JSON.stringify({ profile: 'analyst', sent: true }) })
    expect(open).toHaveBeenCalledWith('analyst', null)
    expect(open.mock.invocationCallOrder[0]).toBeLessThan(send.mock.invocationCallOrder[0])
    expect(send).toHaveBeenCalledWith('analyst', {
      text: 'Check cash',
      images: [],
      whenBusy: 'queue',
      replaces: null
    })
  })

  it('should tell the agent why a message was not sent, in words meant for it', async () => {
    send = vi.fn(async () => {
      useChat.setState({
        chats: { analyst: { error: { key: 'chat.errorSend', detail: 'The engine is busy' } } }
      } as never)
      return false
    })
    const chat = { send, recent, open } as unknown as ChatActions
    call = mcpTools(
      { ...backendFor(engineDouble()), ...botChatBackend(chat) },
      async () => true,
      noSurface
    )

    expect(await call('send_bot_message', { profile: 'analyst', text: 'Check cash' })).toEqual({
      ok: false,
      text: 'The message was not sent. The engine is busy'
    })
  })

  it("should read the bot's newest replies from its chat", async () => {
    const answer = await call('read_bot_replies', { profile: 'analyst', limit: 3 })

    expect(answer).toEqual({
      ok: true,
      text: JSON.stringify({ replies: ['Cash is above the floor.'] })
    })
    expect(recent).toHaveBeenCalledWith('analyst', 3)
  })
})
