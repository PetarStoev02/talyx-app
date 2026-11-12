import { describe, it, expect } from 'vitest'
import { buildApi, ipcErrorMessage, type ApiTransport } from '../../src/shared/api'

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
    ['useInstalledEngine', [], 'engine:use-installed', []],
    ['engineHttp', [{ path: '/api/profiles' }], 'engine:http', [{ path: '/api/profiles' }]],
    ['openEngineSocket', ['id-1', 'default'], 'engine:socket-open', ['id-1', 'default']],
    ['sendEngineSocket', ['id-1', '{}'], 'engine:socket-send', ['id-1', '{}']],
    ['closeEngineSocket', ['id-1'], 'engine:socket-close', ['id-1']],
    ['getAppVersion', [], 'app:version', []],
    ['getDiagnostics', ['0.9.0'], 'app:diagnostics', ['0.9.0']],
    ['getUpdateState', [], 'updater:status', []],
    ['checkForUpdate', [], 'updater:check', []],
    ['downloadUpdate', [], 'updater:download', []],
    ['cancelUpdate', [], 'updater:cancel', []],
    ['installUpdate', [], 'updater:install', []],
    [
      'logError',
      [{ scope: 'chat', message: 'boom' }],
      'log:error',
      [{ scope: 'chat', message: 'boom' }]
    ]
  ] as const)('should invoke %s over %s', async (method, callArgs, channel, wireArgs) => {
    const transport = recordingTransport()
    const api = buildApi(transport) as unknown as Record<string, (...a: unknown[]) => unknown>
    await api[method](...(callArgs as unknown[]))
    expect(transport.calls).toEqual([{ channel, args: wireArgs }])
  })

  it('should expose only the settings, engine, setup, log, about, updater, modules and MCP surface', () => {
    expect(Object.keys(buildApi(recordingTransport())).sort()).toEqual([
      'activateLicense',
      'answerMcp',
      'attachMcp',
      'cancelInstall',
      'cancelUpdate',
      'checkForUpdate',
      'closeEngineSocket',
      'deactivateLicense',
      'downloadUpdate',
      'engineHttp',
      'getAppVersion',
      'getAvailableModules',
      'getDiagnostics',
      'getEngineStatus',
      'getInstallSteps',
      'getMcpConnection',
      'getModulesState',
      'getSettings',
      'getUpdateState',
      'installModule',
      'installUpdate',
      'invokeModule',
      'logError',
      'onActivationRequested',
      'onEngineSocketClosed',
      'onEngineSocketFrame',
      'onInstallExit',
      'onInstallOutput',
      'onMcpCall',
      'onModulesState',
      'onUpdateState',
      'openEngineSocket',
      'pickEnginePath',
      'runInstall',
      'sendEngineSocket',
      'setNativeTheme',
      'setSettings',
      'takeActivationRequest',
      'uninstallModule',
      'useInstalledEngine'
    ])
  })

  it('should hand relayed install output and the exit to their listeners', () => {
    const transport = recordingTransport()
    const api = buildApi(transport)
    const seen: unknown[] = []
    api.onInstallOutput((index, text) => seen.push(['output', index, text]))
    api.onInstallExit((exit) => seen.push(['exit', exit]))
    transport.listeners.get('setup:install-output')?.(2, 'line')
    transport.listeners.get('setup:install-exit')?.({ kind: 'ok' })
    expect(seen).toEqual([
      ['output', 2, 'line'],
      ['exit', { kind: 'ok' }]
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

  it('should subscribe and unsubscribe the update state through the transport', () => {
    const transport = recordingTransport()
    const seen: unknown[] = []
    const unsubscribe = buildApi(transport).onUpdateState((state) => seen.push(state))
    transport.listeners.get('updater:state')?.({ kind: 'none' })
    expect(seen).toEqual([{ kind: 'none' }])
    unsubscribe()
    expect(transport.listeners.has('updater:state')).toBe(false)
  })

  it.each([
    [
      'an Electron invoke rejection',
      "Error invoking remote method 'engine:http': EngineHttpError: Profile not found",
      'Profile not found'
    ],
    [
      'a plain Error rejection',
      "Error invoking remote method 'settings:set': Error: disk full",
      'disk full'
    ],
    [
      'a bridge rejection, already bare',
      'Engine gateway is not connected',
      'Engine gateway is not connected'
    ]
  ])('should give the handler’s own message from %s', (_case, message, expected) => {
    expect(ipcErrorMessage(new Error(message))).toBe(expected)
  })

  it('should reject a failed invoke with the handler’s message only', async () => {
    const api = buildApi({
      invoke: () =>
        Promise.reject(new Error("Error invoking remote method 'settings:get': Error: unreadable")),
      on: () => () => undefined
    })
    await expect(api.getSettings()).rejects.toThrow(/^unreadable$/)
  })
})
