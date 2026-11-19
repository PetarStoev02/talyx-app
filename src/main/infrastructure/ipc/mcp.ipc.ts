import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { app } from 'electron'
import log from 'electron-log'
import { MCP_DEFAULT_PORT, MCP_PATH, mcpToolsVersion } from '@contract/mcp'
import type { McpConnection } from '@contract/mcp'
import { McpCalls, mcpHandler } from '../mcp/mcpServer'
import type { McpPage } from '../mcp/mcpServer'
import { McpAnswerSchema, McpCallIdSchema } from '@contract/channels'
import { handle } from './handle'
import { validateInput } from './validation'

// 256 bits: the bearer token agents send to the MCP server.
const TOKEN_BYTES = 32

const calls = new McpCalls()
// Pages already watched for a close or reload, so a reload does not add listeners again.
const watched = new WeakSet<object>()
const port = Number(process.env['TALYX_MCP_PORT'] ?? MCP_DEFAULT_PORT)

/**
 * Talyx's MCP server, on the loopback interface only. Agents (Talyx's bots and outside ones) call
 * its tools; the open page runs each one through the same code the roster and details use.
 */
export function startMcpServer(): void {
  let key: string
  try {
    key = mcpToken()
  } catch (error) {
    // Like a taken port: Talyx starts, without the server, and the log says why.
    log.error('[MCP] Server did not start: its key could not be read or saved', error)
    return
  }
  const server = createServer(mcpHandler({ token: key, version: app.getVersion(), calls }))
  // A port another program holds leaves Talyx working without the server; the log says why.
  server.on('error', (error) => log.error(`[MCP] Server did not start on port ${port}`, error))
  server.listen(port, '127.0.0.1')
}

export function registerMcpIpc(): void {
  handle('mcp:attach', (event) => {
    const page = event.sender as McpPage & {
      on?: (event: 'destroyed' | 'did-navigate', listener: () => void) => void
    }
    calls.attach(page)
    if (watched.has(page)) return
    watched.add(page)
    const leave = (): void => calls.detach(page)
    page.on?.('destroyed', leave)
    page.on?.('did-navigate', leave)
  })
  handle('mcp:answer', (_event, rawId: unknown, rawAnswer: unknown) =>
    calls.settle(validateInput(McpCallIdSchema, rawId), validateInput(McpAnswerSchema, rawAnswer))
  )
  handle(
    'mcp:connection',
    (): McpConnection => ({
      url: `http://127.0.0.1:${port}${MCP_PATH}?tools=${mcpToolsVersion()}`,
      token: mcpToken()
    })
  )
}

let token: string | null = null

// Kept across restarts, since every bot's profile and outside agents' configs hold it.
function mcpToken(): string {
  if (token) return token
  const path = join(app.getPath('userData'), 'mcp-token')
  const saved = savedToken(path)
  if (saved) return (token = saved)
  const made = randomBytes(TOKEN_BYTES).toString('hex')
  writeFileSync(path, made, { mode: 0o600 })
  return (token = made)
}

/** The saved token, or null when none is saved yet. A file that fails to read is never replaced. */
function savedToken(path: string): string | null {
  try {
    return readFileSync(path, 'utf8').trim() || null
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw new McpTokenError(error)
  }
}

/** The saved MCP token exists but could not be read. */
export class McpTokenError extends Error {
  constructor(cause: unknown) {
    super('Talyx could not read its MCP key', { cause })
    this.name = 'McpTokenError'
  }
}
