import { describe, it, expect } from 'vitest'
import { buildApi, type ApiTransport } from '../../src/shared/api'

function recordingTransport(): ApiTransport & {
  calls: Array<{ channel: string; args: unknown[] }>
} {
  const calls: Array<{ channel: string; args: unknown[] }> = []
  return {
    calls,
    invoke: (channel, ...args) => {
      calls.push({ channel, args })
      return Promise.resolve('result')
    },
    on: () => () => {},
    getPathForFile: () => '/fake/path'
  }
}

describe('buildApi', () => {
  it.each([
    ['getSettings', [], 'settings:get', []],
    ['updateSettings', [{ staleMinutes: 30 }], 'settings:set', [{ staleMinutes: 30 }]]
  ] as const)('%s invokes %s', async (method, callArgs, channel, wireArgs) => {
    const transport = recordingTransport()
    const api = buildApi(transport) as unknown as Record<string, (...a: unknown[]) => unknown>
    await api[method](...(callArgs as unknown[]))
    expect(transport.calls).toEqual([{ channel, args: wireArgs }])
  })
})
