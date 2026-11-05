import { beforeEach, describe, expect, it, vi } from 'vitest'

type Handler = (event: unknown, ...args: unknown[]) => unknown

const handlers = new Map<string, Handler>()
const store = vi.hoisted(() => ({ store: { launchAtLogin: false }, set: vi.fn() }))
const loginItem = vi.hoisted(() => ({ setLaunchAtLogin: vi.fn(), deps: { fake: true } }))

vi.mock('electron', () => ({
  ipcMain: { handle: (channel: string, fn: Handler) => handlers.set(channel, fn) }
}))
vi.mock('../../../src/main/infrastructure/storage/SettingsStore', () => ({
  settingsStore: store
}))
vi.mock('../../../src/main/infrastructure/system/loginItem', () => ({
  setLaunchAtLogin: loginItem.setLaunchAtLogin,
  systemLoginItemDeps: () => loginItem.deps
}))

import { registerSettingsIpc } from '../../../src/main/infrastructure/ipc/settings.ipc'

const set = (partial: unknown): unknown => handlers.get('settings:set')!({}, partial)

describe('settings:set', () => {
  beforeEach(() => {
    handlers.clear()
    vi.clearAllMocks()
    registerSettingsIpc()
  })

  it('should tell the OS before saving a launch-at-login change', async () => {
    loginItem.setLaunchAtLogin.mockResolvedValue(undefined)
    await set({ launchAtLogin: true })
    expect(loginItem.setLaunchAtLogin).toHaveBeenCalledWith(true, loginItem.deps)
    expect(store.set).toHaveBeenCalledWith({ launchAtLogin: true })
  })

  it('should keep the saved setting and reject when the OS refuses', async () => {
    loginItem.setLaunchAtLogin.mockRejectedValue(new Error('denied'))
    await expect(set({ launchAtLogin: true })).rejects.toThrow('denied')
    expect(store.set).not.toHaveBeenCalled()
  })

  it('should leave the OS alone for other settings', async () => {
    await set({ theme: 'dark' })
    expect(loginItem.setLaunchAtLogin).not.toHaveBeenCalled()
    expect(store.set).toHaveBeenCalledWith({ theme: 'dark' })
  })
})
