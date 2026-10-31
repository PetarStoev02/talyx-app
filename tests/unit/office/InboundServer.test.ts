import { describe, it, expect, afterEach, vi } from 'vitest'
import { request } from 'node:http'
import { InboundServer } from '../../../src/main/infrastructure/office/InboundServer'
import { InvalidEventError, UnknownBotError } from '../../../src/main/domain/office/errors'

const TOKEN = 'secret-token'
let server: InboundServer

async function start(
  over: {
    token?: () => string
    onBotEvent?: (b: unknown) => void
    onT3Event?: (b: unknown) => void
  } = {}
): Promise<{ post: (path: string, body: string, auth?: string | null) => Promise<Response> }> {
  server = new InboundServer({
    port: 0,
    token: over.token ?? (() => TOKEN),
    onBotEvent: over.onBotEvent ?? (() => {}),
    onT3Event: over.onT3Event ?? (() => {})
  })
  await server.start()
  const base = `http://127.0.0.1:${server.port()}`
  return {
    post: (path, body, auth = `Bearer ${TOKEN}`) =>
      fetch(base + path, {
        method: 'POST',
        body,
        headers: auth === null ? {} : { Authorization: auth }
      })
  }
}

afterEach(async () => {
  await server.stop()
  vi.restoreAllMocks()
})

describe('InboundServer', () => {
  it('should accept an authorised bot event with 202', async () => {
    const onBotEvent = vi.fn()
    const { post } = await start({ onBotEvent })
    const res = await post('/events', '{"a":1}')
    expect(res.status).toBe(202)
    expect(onBotEvent).toHaveBeenCalledWith({ a: 1 })
  })

  it('should reject a missing token with 401 and not call the handler', async () => {
    const onBotEvent = vi.fn()
    const { post } = await start({ onBotEvent })
    expect((await post('/events', '{}', null)).status).toBe(401)
    expect((await post('/events', '{}', 'Bearer wrong-token')).status).toBe(401)
    expect((await post('/events', '{}', 'Bearer x')).status).toBe(401)
    expect(onBotEvent).not.toHaveBeenCalled()
  })

  it('should reject every request when no token is configured', async () => {
    const onBotEvent = vi.fn()
    const { post } = await start({ token: () => '', onBotEvent })
    expect((await post('/events', '{}', 'Bearer ')).status).toBe(401)
    expect((await post('/events', '{}', 'Bearer')).status).toBe(401)
    expect(onBotEvent).not.toHaveBeenCalled()
  })

  it('should answer 500 when the token cannot be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { post } = await start({
      token: () => {
        throw new Error('decrypt failed')
      }
    })
    expect((await post('/events', '{}')).status).toBe(500)
  })

  it('should reject a declared oversize body with 413 before reading it', async () => {
    const onBotEvent = vi.fn()
    await start({ onBotEvent })
    const status = await new Promise<number>((resolve, reject) => {
      const req = request(
        {
          host: '127.0.0.1',
          port: server.port(),
          method: 'POST',
          path: '/events',
          headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Length': '1000000' }
        },
        (res) => {
          resolve(res.statusCode ?? 0)
          res.resume()
        }
      )
      req.on('error', reject)
      req.write('{')
    })
    expect(status).toBe(413)
    expect(onBotEvent).not.toHaveBeenCalled()
  })

  it('should reject a body over 16 KB with 413', async () => {
    const onBotEvent = vi.fn()
    const { post } = await start({ onBotEvent })
    const res = await post('/events', JSON.stringify({ t: 'x'.repeat(17000) }))
    expect(res.status).toBe(413)
    expect(onBotEvent).not.toHaveBeenCalled()
  })

  it('should reject bad JSON with 400', async () => {
    const { post } = await start()
    expect((await post('/events', '{nope')).status).toBe(400)
  })

  it('should map InvalidEventError to 400', async () => {
    const { post } = await start({
      onBotEvent: () => {
        throw new InvalidEventError('kind', 'is bad')
      }
    })
    expect((await post('/events', '{}')).status).toBe(400)
  })

  it('should name the field a rejected event got wrong', async () => {
    const { post } = await start({
      onBotEvent: () => {
        throw new InvalidEventError('to', 'is required')
      }
    })
    const res = await post('/events', '{}')
    expect(res.status).toBe(400)
    expect(await res.text()).toBe('{"error":"invalid_event","field":"to","reason":"is required"}')
  })

  it('should map UnknownBotError to 404', async () => {
    const { post } = await start({
      onBotEvent: () => {
        throw new UnknownBotError('b1')
      }
    })
    expect((await post('/events', '{}')).status).toBe(404)
  })

  it('should map other errors to 500 without echoing the body', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { post } = await start({
      onBotEvent: () => {
        throw new Error('boom')
      }
    })
    const res = await post('/events', '{"secret":"hunter2"}')
    expect(res.status).toBe(500)
    expect(await res.text()).not.toContain('hunter2')
  })

  it('should route /t3/events to the t3 handler', async () => {
    const onT3Event = vi.fn()
    const onBotEvent = vi.fn()
    const { post } = await start({ onT3Event, onBotEvent })
    expect((await post('/t3/events', '{"b":2}')).status).toBe(202)
    expect(onT3Event).toHaveBeenCalledWith({ b: 2 })
    expect(onBotEvent).not.toHaveBeenCalled()
  })

  it('should answer /health without a token', async () => {
    await start()
    const res = await fetch(`http://127.0.0.1:${server.port()}/health`)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')
  })

  it('should answer 405 to other methods and 404 to unknown paths', async () => {
    const { post } = await start()
    const base = `http://127.0.0.1:${server.port()}`
    const get = await fetch(base + '/events', { headers: { Authorization: `Bearer ${TOKEN}` } })
    expect(get.status).toBe(405)
    expect((await post('/nope', '{}')).status).toBe(404)
  })
})
