import { describe, it, expect, vi } from 'vitest'
import { bridgeConnected, createBrowserTransport } from '../../src/renderer/src/app/browser-bridge'

function fakeEventSource(): {
  source: Pick<EventSource, 'addEventListener'>
  emit: (data: unknown) => void
} {
  let onMessage: ((e: MessageEvent) => void) | null = null
  return {
    source: {
      addEventListener: ((_type: string, listener: EventListenerOrEventListenerObject) => {
        onMessage = listener as (e: MessageEvent) => void
      }) as EventSource['addEventListener']
    },
    emit: (data) => onMessage?.({ data: JSON.stringify(data) } as MessageEvent)
  }
}

describe('createBrowserTransport', () => {
  it('should post channel and args on invoke and unwrap the result', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ ok: true, result: { theme: 'dark' } })
    }) as unknown as typeof fetch
    const transport = createBrowserTransport({
      fetchFn,
      eventSource: () => fakeEventSource().source
    })
    const result = await transport.invoke('settings:set', { theme: 'dark' })
    expect(fetchFn).toHaveBeenCalledWith('/bridge/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'settings:set', args: [{ theme: 'dark' }] })
    })
    expect(result).toEqual({ theme: 'dark' })
  })

  it('should drop trailing undefined args so JSON does not turn them into null', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ ok: true, result: [] })
    }) as unknown as typeof fetch
    const transport = createBrowserTransport({
      fetchFn,
      eventSource: () => fakeEventSource().source
    })
    await transport.invoke('theme:set-native', 'dark', undefined)
    expect(fetchFn).toHaveBeenCalledWith('/bridge/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'theme:set-native', args: ['dark'] })
    })
  })

  it('should reject invoke with the bridge error message', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ ok: false, error: 'No ipcMain handler registered for "x:y"' })
    }) as unknown as typeof fetch
    const transport = createBrowserTransport({
      fetchFn,
      eventSource: () => fakeEventSource().source
    })
    await expect(transport.invoke('x:y')).rejects.toThrow('No ipcMain handler')
  })

  it('should demultiplex SSE events by channel and unsubscribe cleanly', () => {
    const es = fakeEventSource()
    const transport = createBrowserTransport({
      fetchFn: vi.fn() as unknown as typeof fetch,
      eventSource: () => es.source
    })
    const progressEvents: unknown[] = []
    const otherEvents: unknown[] = []
    const offProgress = transport.on('example:progress', (p) => progressEvents.push(p))
    transport.on('example:event', (e) => otherEvents.push(e))
    es.emit({ channel: 'example:progress', args: [{ done: 2 }] })
    es.emit({ channel: 'example:event', args: ['changed'] })
    offProgress()
    es.emit({ channel: 'example:progress', args: [{ done: 3 }] })
    expect(progressEvents).toEqual([{ done: 2 }])
    expect(otherEvents).toEqual(['changed'])
  })
})

describe('bridgeConnected', () => {
  const answering = (status: number, body: unknown): typeof fetch =>
    vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }))

  it('should accept the bridge that serves this renderer', async () => {
    expect(await bridgeConnected(answering(200, { rendererPort: 5173 }), '5173')).toBe(true)
  })

  it.each([
    ['another dev run holds the bridge port', answering(200, { rendererPort: 5174 })],
    ['the bridge refuses the tab', answering(403, {})],
    ['no bridge is listening', vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))]
  ])('should report no connection when %s', async (_case, fetchFn) => {
    expect(await bridgeConnected(fetchFn as typeof fetch, '5173')).toBe(false)
  })
})
