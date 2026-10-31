import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { InvalidEventError, UnknownBotError } from '../../domain/office/errors'

const MAX_BODY_BYTES = 16_384

export interface InboundDeps {
  port: number
  token: () => string
  onBotEvent: (body: unknown) => void
  onT3Event: (body: unknown) => void
}

class TooLargeError extends Error {}

export class InboundServer {
  private server: Server | null = null

  constructor(private readonly deps: InboundDeps) {}

  start(): Promise<void> {
    const server = createServer((req, res) => {
      void this.handle(req, res)
    })
    this.server = server
    return new Promise((resolve, reject) => {
      server.once('error', reject)
      server.listen(this.deps.port, '127.0.0.1', () => resolve())
    })
  }

  stop(): Promise<void> {
    const server = this.server
    this.server = null
    if (!server) return Promise.resolve()
    return new Promise((resolve) => {
      server.close(() => resolve())
      server.closeAllConnections()
    })
  }

  port(): number {
    return (this.server?.address() as AddressInfo).port
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const path = (req.url ?? '').split('?')[0]
    if (req.method === 'GET' && path === '/health') return send(res, 200, 'ok')
    const handler =
      path === '/events' ? this.deps.onBotEvent : path === '/t3/events' ? this.deps.onT3Event : null
    if (!handler) return fail(res, 404, 'not_found')
    if (req.method !== 'POST') return fail(res, 405, 'method_not_allowed')
    if (!this.authorised(req)) return fail(res, 401, 'unauthorized')
    try {
      handler(parseJson(await readBody(req)))
      send(res, 202, '{"ok":true}', 'application/json')
    } catch (err) {
      respondToError(res, err)
    }
  }

  private authorised(req: IncomingMessage): boolean {
    const given = Buffer.from(req.headers.authorization ?? '')
    const expected = Buffer.from(`Bearer ${this.deps.token()}`)
    return given.length === expected.length && timingSafeEqual(given, expected)
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > MAX_BODY_BYTES) {
        reject(new TooLargeError())
        req.removeAllListeners('data')
        req.resume()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    throw new InvalidEventError('body', 'is not valid JSON')
  }
}

function respondToError(res: ServerResponse, err: unknown): void {
  if (err instanceof TooLargeError) return fail(res, 413, 'too_large', true)
  if (err instanceof InvalidEventError) return fail(res, 400, 'invalid_event')
  if (err instanceof UnknownBotError) return fail(res, 404, 'unknown_bot')
  console.error('inbound handler failed:', err instanceof Error ? err.name : 'unknown')
  fail(res, 500, 'internal')
}

function send(res: ServerResponse, status: number, body: string, type = 'text/plain'): void {
  res.writeHead(status, { 'Content-Type': type, 'Content-Length': Buffer.byteLength(body) })
  res.end(body)
}

function fail(res: ServerResponse, status: number, code: string, close = false): void {
  if (close) res.setHeader('Connection', 'close')
  send(res, status, JSON.stringify({ error: code }), 'application/json')
}
