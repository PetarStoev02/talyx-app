import { describe, expect, it } from 'vitest'
import { registerMcpServer } from '../../../src/renderer/src/features/bots/mcpRegistration'
import type { McpServersBackend } from '../../../src/renderer/src/features/bots/mcpRegistration'
import { mcpAddCommand } from '../../../src/shared/mcp'

const CONNECTION = { url: 'http://127.0.0.1:47816/mcp?tools=new', token: 'secret' }
const BOT = { profile: 'scout', sessionId: 'chat-1' }

/** A profile's MCP servers; every change and reload is recorded in order. */
function engineWith(
  servers: { name: string; url: string }[],
  options: { reloadFailsOnce?: string } = {}
): { backend: McpServersBackend; steps: string[]; added: unknown[] } {
  const steps: string[] = []
  const added: unknown[] = []
  const backend: McpServersBackend = {
    listMcpServers: async () => servers,
    addMcpServer: async (profile, server) => {
      steps.push(`add ${profile}`)
      added.push(server)
    },
    removeMcpServer: async (profile, name) => {
      steps.push(`remove ${name} ${profile}`)
    },
    reloadMcp: async ({ profile, sessionId }) => {
      steps.push(`reload ${profile} ${sessionId}`)
      const failure = options.reloadFailsOnce
      options.reloadFailsOnce = undefined
      if (failure) throw new Error(failure)
    }
  }
  return { backend, steps, added }
}

const RELOAD = 'reload scout chat-1'

describe('registerMcpServer', () => {
  it('should add Talyx’s server with its key, then load it in the bot’s chat', async () => {
    const { backend, steps, added } = engineWith([{ name: 'github', url: 'https://example.com' }])
    expect(await registerMcpServer(backend, BOT, CONNECTION)).toBe(true)
    expect(added).toEqual([{ name: 'talyx', url: CONNECTION.url, token: 'secret' }])
    expect(steps).toEqual(['add scout', RELOAD])
  })

  it('should leave a bot that has the current address alone', async () => {
    const { backend, steps } = engineWith([{ name: 'talyx', url: CONNECTION.url }])
    expect(await registerMcpServer(backend, BOT, CONNECTION)).toBe(false)
    expect(steps).toEqual([])
  })

  it('should drop an older address before adding the new one, so the chat gets the new tools', async () => {
    const { backend, steps } = engineWith([
      { name: 'talyx', url: 'http://127.0.0.1:47816/mcp?tools=old' }
    ])
    await registerMcpServer(backend, BOT, CONNECTION)
    // The engine matches servers by name: only a removal it reloaded makes it connect anew.
    expect(steps).toEqual(['remove talyx scout', RELOAD, 'add scout', RELOAD])
  })

  it('should still add the new address when the reload after the removal fails, and say so', async () => {
    const { backend, steps, added } = engineWith(
      [{ name: 'talyx', url: 'http://127.0.0.1:47816/mcp?tools=old' }],
      { reloadFailsOnce: 'Gateway busy' }
    )
    await expect(registerMcpServer(backend, BOT, CONNECTION)).rejects.toThrow('Gateway busy')
    expect(added).toHaveLength(1)
    expect(steps).toEqual(['remove talyx scout', RELOAD, 'add scout'])
  })

  it('should reload the profile without a chat when the bot has none yet', async () => {
    const { backend, steps } = engineWith([])
    await registerMcpServer(backend, { profile: 'scout', sessionId: null }, CONNECTION)
    expect(steps.at(-1)).toBe('reload scout null')
  })
})

describe('mcpAddCommand', () => {
  it('should give an outside agent the address and the key in one line', () => {
    expect(mcpAddCommand({ url: 'http://127.0.0.1:47816/mcp', token: 'secret' })).toBe(
      'claude mcp add --transport http talyx http://127.0.0.1:47816/mcp --header "Authorization: Bearer secret"'
    )
  })
})
