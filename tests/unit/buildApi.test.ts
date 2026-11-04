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
    ['setNativeTheme', ['dark'], 'theme:set-native', ['dark']]
  ] as const)('should invoke %s over %s', async (method, callArgs, channel, wireArgs) => {
    const transport = recordingTransport()
    const api = buildApi(transport) as unknown as Record<string, (...a: unknown[]) => unknown>
    await api[method](...(callArgs as unknown[]))
    expect(transport.calls).toEqual([{ channel, args: wireArgs }])
  })

  it('should expose only the settings and updater surface', () => {
    expect(Object.keys(buildApi(recordingTransport())).sort()).toEqual([
      'getSettings',
      'onUpdateAvailable',
      'setNativeTheme',
      'setSettings'
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
