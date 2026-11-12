import { describe, expect, it } from 'vitest'
import { registerMcpServer } from '../../../src/renderer/src/features/bots/mcpRegistration'
import type { RosterBackend } from '../../../src/renderer/src/features/bots/data'
import { mcpAddCommand } from '../../../src/shared/mcp'

const CONNECTION = { url: 'http://127.0.0.1:47816/mcp', token: 'secret' }

/** A profile's MCP servers over the engine's REST, as `GET/POST /api/mcp/servers` keep them. */
function engineWith(servers: { name: string; url: string }[]): {
  backend: RosterBackend
  writes: unknown[]
} {
  const writes: unknown[] = []
  const backend = {
    http: async (request: { method?: string; body?: unknown }) => {
      if (request.method === 'POST') {
        writes.push(request.body)
        return {}
      }
      return { servers }
    }
  } as unknown as RosterBackend
  return { backend, writes }
}

describe('registerMcpServer', () => {
  it('should add Talyx’s server to a bot that lacks it, with its key for the engine to keep', async () => {
    const { backend, writes } = engineWith([{ name: 'github', url: 'https://example.com' }])
    await registerMcpServer(backend, 'scout', CONNECTION)
    expect(writes).toEqual([
      { name: 'talyx', url: CONNECTION.url, auth: 'header', bearer_token: 'secret' }
    ])
  })

  it('should leave a bot that already has it alone', async () => {
    const { backend, writes } = engineWith([{ name: 'talyx', url: CONNECTION.url }])
    await registerMcpServer(backend, 'scout', CONNECTION)
    expect(writes).toEqual([])
  })
})

describe('mcpAddCommand', () => {
  it('should give an outside agent the address and the key in one line', () => {
    expect(mcpAddCommand(CONNECTION)).toBe(
      'claude mcp add --transport http talyx http://127.0.0.1:47816/mcp --header "Authorization: Bearer secret"'
    )
  })
})
