import { describe, it, expect, vi } from 'vitest'
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
    },
    getPathForFile: () => '/fake/path'
  }
}

describe('buildApi', () => {
  it.each([
    ['selectFolder', [], 'folder:select', []],
    ['scanFolderForSort', ['/tmp/x'], 'folder:scan-for-sort', ['/tmp/x']],
    ['previewSort', [[{ p: 1 }]], 'sort:preview', [[{ p: 1 }]]],
    ['agentRun', ['sort my stuff'], 'agent:run', [{ instruction: 'sort my stuff' }]],
    ['getSettings', [], 'settings:get', []],
    ['searchFiles', ['invoice'], 'search:query', ['invoice', undefined]]
  ] as const)('%s invokes %s', async (method, callArgs, channel, wireArgs) => {
    const transport = recordingTransport()
    const api = buildApi(transport) as unknown as Record<string, (...a: unknown[]) => unknown>
    await api[method](...(callArgs as unknown[]))
    expect(transport.calls).toEqual([{ channel, args: wireArgs }])
  })

  it('should expose no licence, trial, checkout or team calls', () => {
    const api = buildApi(recordingTransport())
    const gone = [
      'getLicenseStatus',
      'activateLicense',
      'deactivateLicense',
      'getDeviceId',
      'openCheckout',
      'openPricing',
      'getTrialStatus',
      'getTrialUsage',
      'getTeamInfo',
      'exportTeamConfig',
      'importTeamConfig',
      'exportUsageReport'
    ]
    for (const name of gone) expect(Object.keys(api)).not.toContain(name)
  })

  it('should expose no calls for removed features', () => {
    const api = Object.keys(buildApi(recordingTransport()))
    const gone = [
      'mcpConfiguredClients',
      'mcpServerPath',
      'mcpIsTalyxRegistered',
      'mcpInstallClaudeDesktop',
      'getContextMenuStatus',
      'uninstallContextMenu',
      'recall',
      'captureStats'
    ]
    for (const name of gone) expect(api).not.toContain(name)
  })

  it('should subscribe and unsubscribe progress listeners through the transport', () => {
    const transport = recordingTransport()
    const api = buildApi(transport)
    const seen: unknown[] = []
    const unsubscribe = api.onSortProgress((p) => seen.push(p))
    transport.listeners.get('sort:progress')?.({ done: 1 })
    expect(seen).toEqual([{ done: 1 }])
    unsubscribe()
    expect(transport.listeners.has('sort:progress')).toBe(false)
  })

  it('should subscribe to the overlay being brought forward', () => {
    const transport = recordingTransport()
    const api = buildApi(transport)
    const callback = vi.fn()
    const unsubscribe = api.onAssistantFocus(callback)
    transport.listeners.get('assistant:focus')?.()
    expect(callback).toHaveBeenCalledOnce()
    unsubscribe()
    expect(transport.listeners.has('assistant:focus')).toBe(false)
  })

  it('should route getPathForFile through the transport', () => {
    const transport = recordingTransport()
    const api = buildApi(transport)
    expect(api.getPathForFile(new File([], 'a.txt'))).toBe('/fake/path')
  })
})
