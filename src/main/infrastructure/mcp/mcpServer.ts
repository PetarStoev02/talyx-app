import { randomUUID, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import log from 'electron-log'
import { MCP_CALL_TIMEOUT_MS, MCP_PATH, isMcpTool, mcpToolList } from '@contract/mcp'
import type { McpAnswer } from '@contract/mcp'
import type { EventChannels } from '@contract/channels'
import { HTTP_STATUS } from '../httpStatus'

// The MCP revision this server speaks; a client asking for another gets this one back.
const PROTOCOL_VERSION = '2025-06-18'
const MAX_BODY_BYTES = 1_048_576 // 1 MiB
// JSON-RPC 2.0's error codes.
const RPC_ERROR = {
  parse: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internal: -32603
} as const

/** The page that runs tool calls: the Talyx window, or the dev bridge's browser tab. */
export interface McpPage {
  send: (channel: 'mcp:call', ...args: EventChannels['mcp:call']) => void
  isDestroyed: () => boolean
}

export const NO_WINDOW =
  'Talyx’s window is not open, so nothing was changed. Open Talyx and try again.'
const TIMED_OUT = 'Talyx did not answer in time, so the call was dropped. Try again.'

/**
 * Hands tool calls to the page and waits for its answers. The page that attached last runs them;
 * a page that closes or reloads fails its calls instead of leaving them waiting.
 */
export class McpCalls {
  private page: McpPage | null = null
  private readonly pending = new Map<string, (answer: McpAnswer) => void>()

  constructor(private readonly timeoutMs = MCP_CALL_TIMEOUT_MS) {}

  attach(page: McpPage): void {
    if (this.page !== page) this.failAll()
    this.page = page
  }

  detach(page: McpPage): void {
    if (this.page !== page) return
    this.page = null
    this.failAll()
  }

  run(tool: string, args: unknown): Promise<McpAnswer> {
    const page = this.page
    if (!page || page.isDestroyed()) return Promise.resolve({ ok: false, text: NO_WINDOW })
    const id = randomUUID()
    return new Promise((resolve) => {
      const timer = setTimeout(
        () => this.settle(id, { ok: false, text: TIMED_OUT }),
        this.timeoutMs
      )
      this.pending.set(id, (answer) => {
        clearTimeout(timer)
        resolve(answer)
      })
      page.send('mcp:call', { id, tool, args })
    })
  }

  /** The page's answer; an unknown id (timed out, or from another page) is ignored. */
  settle(id: string, answer: McpAnswer): void {
    const resolve = this.pending.get(id)
    this.pending.delete(id)
    resolve?.(answer)
  }

  private failAll(): void {
    for (const id of [...this.pending.keys()]) this.settle(id, { ok: false, text: NO_WINDOW })
  }
}

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id?: string | number | null
  method: string
  params?: Record<string, unknown>
}

/**
 * The MCP Streamable HTTP endpoint: one JSON-RPC message per POST, answered as plain JSON (no
 * stream: every answer is a single result). Only a request with the token gets in, and none that
 * a browser page sent: a page always adds an Origin header, an agent never does.
 */
export function mcpHandler(deps: {
  token: string
  version: string
  calls: Pick<McpCalls, 'run'>
}): (req: IncomingMessage, res: ServerResponse) => void {
  return (req, res) => {
    void handle(deps, req, res).catch((error: unknown) => {
      log.error('[MCP] Request failed', error)
      reply(res, HTTP_STATUS.internalError, rpcError(null, RPC_ERROR.internal, 'Internal error'))
    })
  }
}

async function handle(
  deps: { token: string; version: string; calls: Pick<McpCalls, 'run'> },
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (new URL(req.url ?? '/', 'http://localhost').pathname !== MCP_PATH)
    return reply(res, HTTP_STATUS.notFound)
  if (req.headers.origin !== undefined) return reply(res, HTTP_STATUS.forbidden)
  if (!authorized(req.headers.authorization, deps.token))
    return reply(res, HTTP_STATUS.unauthorized)
  if (req.method !== 'POST')
    return reply(res, HTTP_STATUS.methodNotAllowed, undefined, { Allow: 'POST' })
  let message: JsonRpcRequest
  try {
    message = JSON.parse(await readBody(req)) as JsonRpcRequest
  } catch {
    return reply(res, HTTP_STATUS.badRequest, rpcError(null, RPC_ERROR.parse, 'Parse error'))
  }
  if (!message || typeof message.method !== 'string')
    return reply(
      res,
      HTTP_STATUS.badRequest,
      rpcError(null, RPC_ERROR.invalidRequest, 'Invalid request')
    )
  // A notification (initialized, cancelled) needs no answer.
  if (message.id === undefined) return reply(res, HTTP_STATUS.accepted)
  reply(res, HTTP_STATUS.ok, await answer(deps, message))
}

async function answer(
  deps: { version: string; calls: Pick<McpCalls, 'run'> },
  { id, method, params }: JsonRpcRequest
): Promise<unknown> {
  const result = (value: unknown): unknown => ({ jsonrpc: '2.0', id, result: value })
  switch (method) {
    case 'initialize':
      return result({
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'talyx', version: deps.version },
        instructions:
          'Operate the Talyx app: its bots, folders, pins, rooms, usage and bot settings. Talyx must be open.'
      })
    case 'ping':
      return result({})
    case 'tools/list':
      return result({ tools: mcpToolList() })
    case 'tools/call': {
      const name = typeof params?.name === 'string' ? params.name : ''
      if (!isMcpTool(name)) return rpcError(id, RPC_ERROR.invalidParams, `Unknown tool: ${name}`)
      const { ok, text } = await deps.calls.run(name, params?.arguments ?? {})
      return result({ content: [{ type: 'text', text }], isError: !ok })
    }
    default:
      return rpcError(id, RPC_ERROR.methodNotFound, `Method not found: ${method}`)
  }
}

function authorized(header: string | undefined, token: string): boolean {
  const given = Buffer.from(header ?? '')
  const wanted = Buffer.from(`Bearer ${token}`)
  return given.length === wanted.length && timingSafeEqual(given, wanted)
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Body too large'))
        req.destroy()
      } else chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function rpcError(id: unknown, code: number, message: string): unknown {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } }
}

function reply(
  res: ServerResponse,
  status: number,
  body?: unknown,
  headers: Record<string, string> = {}
): void {
  if (res.headersSent) return
  res.writeHead(
    status,
    body === undefined ? headers : { ...headers, 'Content-Type': 'application/json' }
  )
  res.end(body === undefined ? undefined : JSON.stringify(body))
}
