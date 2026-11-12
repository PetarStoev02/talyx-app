import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { app, ipcMain } from 'electron'
import log from 'electron-log'
import { z } from 'zod/v4'
import { MCP_DEFAULT_PORT, MCP_PATH } from '../../../shared/mcp'
import type { McpConnection } from '../../../shared/mcp'
import { McpCalls, mcpHandler } from '../mcp/mcpServer'
import type { McpPage } from '../mcp/mcpServer'
import { validateInput } from './validation'

const McpAnswerSchema = z.object({ ok: z.boolean(), text: z.string().max(1024 * 1024) })
const McpCallIdSchema = z.string().uuid()

const calls = new McpCalls()
const port = Number(process.env['TALYX_MCP_PORT'] ?? MCP_DEFAULT_PORT)

/**
 * Talyx's MCP server, on the loopback interface only. Agents (Talyx's bots and outside ones) call
 * its tools; the open page runs each one through the same code the roster and details use.
 */
export function startMcpServer(): void {
  const server = createServer(mcpHandler({ token: mcpToken(), version: app.getVersion(), calls }))
  // A port another program holds leaves Talyx working without the server; the log says why.
  server.on('error', (error) => log.error(`[MCP] Server did not start on port ${port}`, error))
  server.listen(port, '127.0.0.1')
}

export function registerMcpIpc(): void {
  ipcMain.handle('mcp:attach', (event) => {
    const page = event.sender as McpPage & {
      on?: (event: 'destroyed' | 'did-navigate', listener: () => void) => void
    }
    calls.attach(page)
    const leave = (): void => calls.detach(page)
    page.on?.('destroyed', leave)
    page.on?.('did-navigate', leave)
  })
  ipcMain.handle('mcp:answer', (_event, rawId: unknown, rawAnswer: unknown) =>
    calls.settle(validateInput(McpCallIdSchema, rawId), validateInput(McpAnswerSchema, rawAnswer))
  )
  ipcMain.handle(
    'mcp:connection',
    (): McpConnection => ({ url: `http://127.0.0.1:${port}${MCP_PATH}`, token: mcpToken() })
  )
}

let token: string | null = null

// Kept across restarts, since every bot's profile and outside agents' configs hold it.
function mcpToken(): string {
  if (token) return token
  const path = join(app.getPath('userData'), 'mcp-token')
  try {
    token = readFileSync(path, 'utf8').trim()
  } catch {
    // No token yet: the first start makes one.
  }
  if (!token) {
    token = randomBytes(32).toString('hex')
    writeFileSync(path, token, { mode: 0o600 })
  }
  return token
}
