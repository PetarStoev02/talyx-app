import { describe, expect, it } from 'vitest'
import { registerMcpServer } from '../../../src/renderer/src/features/bots/mcpRegistration'
import type { RosterBackend } from '../../../src/renderer/src/features/bots/data'
import { mcpAddCommand } from '../../../src/shared/mcp'

const CONNECTION = { url: 'http://127.0.0.1:47816/mcp?tools=new', token: 'secret' }
const BOT = { profile: 'scout', sessionId: 'chat-1' }

/**
 * A profile's MCP servers as the engine keeps them: REST for the config, `reload.mcp` on the
 * socket. Every step is recorded in order, the way the engine would see it.
 */
function engineWith(
  servers: { name: string; url: string }[],
  options: { deleteFails?: string; reloadFailsOnce?: string } = {}
): { backend: RosterBackend; steps: string[]; added: unknown[] } {
  const steps: string[] = []
  const added: unknown[] = []
  const backend = {
    http: async (request: { path: string; method?: string; body?: unknown }) => {
      const method = request.method ?? 'GET'
      if (method === 'GET') return { servers }
      steps.push(`${method} ${request.path}`)
      if (method === 'DELETE' && options.deleteFails) throw new Error(options.deleteFails)
      if (method === 'POST') added.push(request.body)
      return {}
    },
    request: async (profile: string, method: string, params: Record<string, unknown>) => {
      steps.push(`${method} ${profile} ${JSON.stringify(params)}`)
      const failure = options.reloadFailsOnce
      options.reloadFailsOnce = undefined
      if (failure) throw new Error(failure)
      return { status: 'reloaded' }
    }
  } as unknown as RosterBackend
  return { backend, steps, added }
}

const RELOAD = 'reload.mcp scout {"confirm":true,"session_id":"chat-1"}'

describe('registerMcpServer', () => {
  it('should add Talyx’s server with its key for the engine to keep, then load it in the bot’s chat', async () => {
    const { backend, steps, added } = engineWith([{ name: 'github', url: 'https://example.com' }])
    expect(await registerMcpServer(backend, BOT, CONNECTION)).toBe(true)
    expect(added).toEqual([
      { name: 'talyx', url: CONNECTION.url, auth: 'header', bearer_token: 'secret' }
    ])
    expect(steps).toEqual(['POST /api/mcp/servers?profile=scout', RELOAD])
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
    expect(steps).toEqual([
      'DELETE /api/mcp/servers/talyx?profile=scout',
      RELOAD,
      'POST /api/mcp/servers?profile=scout',
      RELOAD
    ])
  })

  it('should go on when the old entry is already gone', async () => {
    const { backend, added } = engineWith(
      [{ name: 'talyx', url: 'http://127.0.0.1:47816/mcp?tools=old' }],
      { deleteFails: "Engine HTTP 404: Server 'talyx' not found" }
    )
    await registerMcpServer(backend, BOT, CONNECTION)
    expect(added).toHaveLength(1)
  })

  it('should still add the new address when the reload after the removal fails, and say so', async () => {
    const { backend, steps, added } = engineWith(
      [{ name: 'talyx', url: 'http://127.0.0.1:47816/mcp?tools=old' }],
      { reloadFailsOnce: 'Gateway busy' }
    )
    await expect(registerMcpServer(backend, BOT, CONNECTION)).rejects.toThrow('Gateway busy')
    expect(added).toHaveLength(1)
    expect(steps).toEqual([
      'DELETE /api/mcp/servers/talyx?profile=scout',
      RELOAD,
      'POST /api/mcp/servers?profile=scout'
    ])
  })

  it('should reload the profile without a chat when the bot has none yet', async () => {
    const { backend, steps } = engineWith([])
    await registerMcpServer(backend, { profile: 'scout', sessionId: null }, CONNECTION)
    expect(steps.at(-1)).toBe('reload.mcp scout {"confirm":true}')
  })
})

describe('mcpAddCommand', () => {
  it('should give an outside agent the address and the key in one line', () => {
    expect(mcpAddCommand({ url: 'http://127.0.0.1:47816/mcp', token: 'secret' })).toBe(
      'claude mcp add --transport http talyx http://127.0.0.1:47816/mcp --header "Authorization: Bearer secret"'
    )
  })
})
