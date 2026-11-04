import { describe, it, expect } from 'vitest'
import { buildApi, type ApiTransport } from '../../src/shared/api'

function recordingTransport(): ApiTransport & {
  calls: Array<{ channel: string; args: unknown[] }>
  listeners: Map<string, (...args: unknown[]) => void>
} {
  const calls: Array<{ channel: string; args: unknown[] }> = []
  const listeners = new Map<string, (...args: unknown[]) => void>()
  return {
    calls,
    listeners,
    invoke: (channel, ...args) => {
      calls.push({ channel, args })
      return Promise.resolve('result')
    },
    on: (channel, listener) => {
      listeners.set(channel, listener)
      return () => listeners.delete(channel)
    }
  }
}

describe('buildApi', () => {
  it.each([
    ['getSettings', [], 'settings:get', []],
    ['setSettings', [{ theme: 'dark' }], 'settings:set', [{ theme: 'dark' }]],
    ['setNativeTheme', ['dark'], 'theme:set-native', ['dark']],
    ['getEngineStatus', [], 'engine:status', []],
    ['pickEnginePath', [], 'engine:pick-path', []],
    ['engineHttp', [{ path: '/api/profiles' }], 'engine:http', [{ path: '/api/profiles' }]],
    ['openEngineSocket', ['id-1', 'default'], 'engine:socket-open', ['id-1', 'default']],
    ['sendEngineSocket', ['id-1', '{}'], 'engine:socket-send', ['id-1', '{}']],
    ['closeEngineSocket', ['id-1'], 'engine:socket-close', ['id-1']]
  ] as const)('should invoke %s over %s', async (method, callArgs, channel, wireArgs) => {
    const transport = recordingTransport()
    const api = buildApi(transport) as unknown as Record<string, (...a: unknown[]) => unknown>
    await api[method](...(callArgs as unknown[]))
    expect(transport.calls).toEqual([{ channel, args: wireArgs }])
  })

  it('should expose only the settings, engine and updater surface', () => {
    expect(Object.keys(buildApi(recordingTransport())).sort()).toEqual([
      'closeEngineSocket',
      'engineHttp',
      'getEngineStatus',
      'getSettings',
      'onEngineSocketClosed',
      'onEngineSocketFrame',
      'onUpdateAvailable',
      'openEngineSocket',
      'pickEnginePath',
      'sendEngineSocket',
      'setNativeTheme',
      'setSettings'
    ])
  })

  it('should hand relayed engine socket frames and closes to their listeners', () => {
    const transport = recordingTransport()
    const api = buildApi(transport)
    const seen: unknown[] = []
    api.onEngineSocketFrame((id, text) => seen.push(['frame', id, text]))
    api.onEngineSocketClosed((id, code, reason) => seen.push(['closed', id, code, reason]))
    transport.listeners.get('engine:socket-frame')?.('id-1', '{"a":1}')
    transport.listeners.get('engine:socket-closed')?.('id-1', 1006, 'gone')
    expect(seen).toEqual([
      ['frame', 'id-1', '{"a":1}'],
      ['closed', 'id-1', 1006, 'gone']
    ])
  })

  it('should subscribe and unsubscribe the update announcement through the transport', () => {
    const transport = recordingTransport()
    const seen: unknown[] = []
    const unsubscribe = buildApi(transport).onUpdateAvailable((info) => seen.push(info))
    transport.listeners.get('updater:update-available')?.({ version: '1.0.0', url: 'u' })
    expect(seen).toEqual([{ version: '1.0.0', url: 'u' }])
    unsubscribe()
    expect(transport.listeners.has('updater:update-available')).toBe(false)
  })
})
