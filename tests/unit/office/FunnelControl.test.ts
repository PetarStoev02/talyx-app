import { describe, it, expect, vi } from 'vitest'
import { FunnelControl } from '../../../src/main/infrastructure/office/FunnelControl'

const ON = JSON.stringify({
  TCP: { '8443': { HTTPS: true } },
  Web: { 'mac.tail1.ts.net:8443': { Handlers: { '/': { Proxy: 'http://127.0.0.1:47321' } } } },
  AllowFunnel: { 'mac.tail1.ts.net:8443': true }
})

describe('FunnelControl', () => {
  it('should report the public url when funnel is on', async () => {
    const f = new FunnelControl(async () => ON)
    expect(await f.status(47321)).toEqual({ on: true, url: 'https://mac.tail1.ts.net:8443' })
  })

  it('should report off when status lists no funnel', async () => {
    expect(await new FunnelControl(async () => '{}').status(47321)).toEqual({
      on: false,
      url: null
    })
  })

  it('should report off when funnel proxies a different port', async () => {
    expect(await new FunnelControl(async () => ON).status(9999)).toEqual({ on: false, url: null })
  })

  it('should ignore a funnel on :443 that proxies the same port', async () => {
    const on443 = JSON.stringify({
      Web: { 'mac.tail1.ts.net:443': { Handlers: { '/': { Proxy: 'http://127.0.0.1:47321' } } } },
      AllowFunnel: { 'mac.tail1.ts.net:443': true }
    })
    expect(await new FunnelControl(async () => on443).status(47321)).toEqual({
      on: false,
      url: null
    })
  })

  it('should run the exact tailscale arguments', async () => {
    const run = vi.fn(async () => '')
    const f = new FunnelControl(run)
    await f.enable(47321)
    await f.disable()
    expect(run).toHaveBeenNthCalledWith(1, ['funnel', '--bg', '--https=8443', '47321'])
    expect(run).toHaveBeenNthCalledWith(2, ['funnel', '--https=8443', 'off'])
  })
})
