import { createServer } from 'node:http'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { McpCalls, NO_WINDOW, mcpHandler } from '../../../src/main/infrastructure/mcp/mcpServer'
import type { McpPage } from '../../../src/main/infrastructure/mcp/mcpServer'
import type { McpCall } from '../../../src/shared/mcp'

const TOKEN = 'secret-token'

/** A page that answers every call with what the tool and its arguments were. */
function echoPage(calls: McpCalls): McpPage & { sent: McpCall[]; destroyed: boolean } {
  const page = {
    sent: [] as McpCall[],
    destroyed: false,
    isDestroyed: () => page.destroyed,
    send: (_channel: 'mcp:call', call: McpCall) => {
      page.sent.push(call)
      queueMicrotask(() =>
        calls.settle(call.id, { ok: true, text: `${call.tool} ${JSON.stringify(call.args)}` })
      )
    }
  }
  return page
}

let server: Server
let calls: McpCalls
let url: string

beforeEach(async () => {
  calls = new McpCalls(50)
  server = createServer(mcpHandler({ token: TOKEN, version: '9.9.9', calls }))
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/mcp`
})

afterEach(() => new Promise<void>((resolve) => server.close(() => resolve())))

function post(body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, ...headers },
    body: JSON.stringify(body)
  })
}

async function rpc(method: string, params: unknown = {}): Promise<Record<string, unknown>> {
  const response = await post({ jsonrpc: '2.0', id: 1, method, params })
  return (await response.json()) as Record<string, unknown>
}

describe('Talyx MCP server', () => {
  describe('given a request it must not let in', () => {
    it('should refuse a request without the token', async () => {
      const response = await post({}, { Authorization: 'Bearer wrong' })
      expect(response.status).toBe(401)
    })

    it('should refuse a request a browser page sent, even with the token', async () => {
      const response = await post({}, { Origin: 'http://example.com' })
      expect(response.status).toBe(403)
    })
  })

  describe('given an agent with the token', () => {
    it('should say what it is and that it has tools', async () => {
      const { result } = await rpc('initialize', { protocolVersion: '2025-06-18' })
      expect(result).toMatchObject({
        capabilities: { tools: {} },
        serverInfo: { name: 'talyx', version: '9.9.9' }
      })
    })

    it('should accept a notification without an answer', async () => {
      const response = await post({ jsonrpc: '2.0', method: 'notifications/initialized' })
      expect(response.status).toBe(202)
    })

    it('should list every tool with its argument schema and whether it asks first', async () => {
      const { result } = (await rpc('tools/list')) as {
        result: { tools: { name: string; inputSchema: object; annotations: object }[] }
      }
      const deleteBot = result.tools.find((tool) => tool.name === 'delete_bot')
      expect(deleteBot?.annotations).toEqual({ destructiveHint: true })
      expect(deleteBot?.inputSchema).toMatchObject({ required: ['profile'] })
    })

    it('should hand a call to the open page and return its answer', async () => {
      const page = echoPage(calls)
      calls.attach(page)
      const { result } = await rpc('tools/call', {
        name: 'pin_item',
        arguments: { kind: 'bot', id: 'scout', pinned: true }
      })
      expect(result).toEqual({
        content: [{ type: 'text', text: 'pin_item {"kind":"bot","id":"scout","pinned":true}' }],
        isError: false
      })
    })

    it('should refuse clearly, changing nothing, when no Talyx window is open', async () => {
      const { result } = await rpc('tools/call', {
        name: 'delete_bot',
        arguments: { profile: 'x' }
      })
      expect(result).toEqual({ content: [{ type: 'text', text: NO_WINDOW }], isError: true })
    })

    it('should refuse a tool it does not have', async () => {
      const { error } = await rpc('tools/call', { name: 'format_disk' })
      expect(error).toMatchObject({ code: -32602 })
    })
  })

  describe('given a page that goes away', () => {
    it('should fail a call the closed page never answered', async () => {
      const page = { send: () => undefined, isDestroyed: () => false }
      calls.attach(page)
      const pending = calls.run('delete_bot', {})
      calls.detach(page)
      expect(await pending).toEqual({ ok: false, text: NO_WINDOW })
    })

    it('should drop a call nobody answers in time', async () => {
      calls.attach({ send: () => undefined, isDestroyed: () => false })
      expect((await calls.run('list_roster', {})).ok).toBe(false)
    })
  })
})
