import { describe, it, expect, vi } from 'vitest'
import { createBrowserTransport } from '../../src/renderer/src/app/browser-bridge'

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
      json: () => Promise.resolve({ ok: true, result: [{ name: 'a.txt' }] })
    }) as unknown as typeof fetch
    const transport = createBrowserTransport({
      fetchFn,
      eventSource: () => fakeEventSource().source
    })
    const result = await transport.invoke('folder:scan', '/tmp')
    expect(fetchFn).toHaveBeenCalledWith('/bridge/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'folder:scan', args: ['/tmp'] })
    })
    expect(result).toEqual([{ name: 'a.txt' }])
  })

  it('should drop trailing undefined args so JSON does not turn them into null', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ ok: true, result: [] })
    }) as unknown as typeof fetch
    const transport = createBrowserTransport({
      fetchFn,
      eventSource: () => fakeEventSource().source
    })
    await transport.invoke('sort:preview', [{ p: 1 }], undefined)
    expect(fetchFn).toHaveBeenCalledWith('/bridge/invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'sort:preview', args: [[{ p: 1 }]] })
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
    const sortEvents: unknown[] = []
    const watchEvents: unknown[] = []
    const offSort = transport.on('sort:progress', (p) => sortEvents.push(p))
    transport.on('watch:event', (e) => watchEvents.push(e))
    es.emit({ channel: 'sort:progress', args: [{ done: 2 }] })
    es.emit({ channel: 'watch:event', args: ['moved'] })
    offSort()
    es.emit({ channel: 'sort:progress', args: [{ done: 3 }] })
    expect(sortEvents).toEqual([{ done: 2 }])
    expect(watchEvents).toEqual(['moved'])
  })

  it('should throw a browser-mode explanation from getPathForFile', () => {
    const transport = createBrowserTransport({
      fetchFn: vi.fn() as unknown as typeof fetch,
      eventSource: () => fakeEventSource().source
    })
    expect(() => transport.getPathForFile(new File([], 'a'))).toThrow(/folder picker/)
  })
})
