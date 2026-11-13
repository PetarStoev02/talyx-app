import { describe, expect, it } from 'vitest'
import type { EngineAccess } from '../../../src/renderer/src/app/engine/access'
import { engineMcpBackend } from '../../../src/renderer/src/app/engine/mcp'
import type { EngineApiRequest } from '../../../src/renderer/src/shared/engine/http'

// The MCP servers' wiring: REST for a profile's config, `reload.mcp` on the socket.
function engineRecording(options: { httpFails?: string } = {}): {
  engine: EngineAccess
  sent: unknown[]
} {
  const sent: unknown[] = []
  const engine: EngineAccess = {
    request: async <T>(profile: string, method: string, params?: Record<string, unknown>) => {
      sent.push({ profile, method, params })
      return { status: 'reloaded' } as T
    },
    http: async <T>(request: EngineApiRequest) => {
      sent.push(request)
      if (options.httpFails) throw new Error(options.httpFails)
      return { servers: [{ name: 'talyx', url: null }] } as T
    }
  }
  return { engine, sent }
}

describe('engine MCP servers backend', () => {
  it('should list the profile’s servers', async () => {
    const { engine, sent } = engineRecording()
    expect(await engineMcpBackend(engine).listMcpServers('scout')).toEqual([
      { name: 'talyx', url: null }
    ])
    expect(sent).toEqual([{ path: '/api/mcp/servers?profile=scout', profile: 'scout' }])
  })

  it('should add a server with its key sent as a bearer header for the engine to keep', async () => {
    const { engine, sent } = engineRecording()
    await engineMcpBackend(engine).addMcpServer('scout', {
      name: 'talyx',
      url: 'http://127.0.0.1:47816/mcp',
      token: 'secret'
    })
    expect(sent).toEqual([
      {
        path: '/api/mcp/servers?profile=scout',
        method: 'POST',
        body: {
          name: 'talyx',
          url: 'http://127.0.0.1:47816/mcp',
          auth: 'header',
          bearer_token: 'secret'
        },
        profile: 'scout'
      }
    ])
  })

  it('should remove a server by name, and count one already gone as removed', async () => {
    const { engine, sent } = engineRecording({
      httpFails: "Engine HTTP 404: Server 'talyx' not found"
    })
    await engineMcpBackend(engine).removeMcpServer('scout', 'talyx')
    expect(sent).toEqual([
      { path: '/api/mcp/servers/talyx?profile=scout', method: 'DELETE', profile: 'scout' }
    ])
  })

  it('should report any other failure to remove a server', async () => {
    const { engine } = engineRecording({ httpFails: 'Engine HTTP 500' })
    await expect(engineMcpBackend(engine).removeMcpServer('scout', 'talyx')).rejects.toThrow(
      'Engine HTTP 500'
    )
  })

  it('should reload the profile’s servers in its open chat, or in none', async () => {
    const { engine, sent } = engineRecording()
    const backend = engineMcpBackend(engine)
    await backend.reloadMcp({ profile: 'scout', sessionId: 'chat-1' })
    await backend.reloadMcp({ profile: 'scout', sessionId: null })
    expect(sent).toEqual([
      {
        profile: 'scout',
        method: 'reload.mcp',
        params: { confirm: true, session_id: 'chat-1' }
      },
      { profile: 'scout', method: 'reload.mcp', params: { confirm: true } }
    ])
  })
})
