import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({ app: {} }))

import {
  LaunchAtLoginError,
  autostartEntry,
  readLaunchAtLogin,
  setLaunchAtLogin,
  type LoginItemDeps
} from '../../../src/main/infrastructure/system/loginItem'

const APPIMAGE = '/home/me/Apps/Talyx-x64.AppImage'

function fakeDeps(overrides: Partial<LoginItemDeps> = {}): {
  deps: LoginItemDeps
  files: Map<string, string>
  loginItem: { openAtLogin: boolean }
} {
  const files = new Map<string, string>()
  const loginItem = { openAtLogin: false }
  const deps: LoginItemDeps = {
    platform: 'linux',
    packaged: true,
    env: { APPIMAGE },
    execPath: '/opt/Talyx/talyx',
    homedir: '/home/me',
    app: {
      setLoginItemSettings: (settings) => {
        loginItem.openAtLogin = settings.openAtLogin
      },
      getLoginItemSettings: () => ({ openAtLogin: loginItem.openAtLogin })
    },
    fs: {
      mkdir: async () => undefined,
      writeFile: async (path, text) => void files.set(path, text),
      rm: async (path) => void files.delete(path),
      exists: async (path) => files.has(path)
    },
    ...overrides
  }
  return { deps, files, loginItem }
}

const ENTRY_PATH = '/home/me/.config/autostart/talyx.desktop'

describe('autostartEntry', () => {
  it('should describe a desktop application that starts with the session', () => {
    expect(autostartEntry(APPIMAGE)).toBe(
      [
        '[Desktop Entry]',
        'Type=Application',
        'Name=Talyx',
        `Exec="${APPIMAGE}"`,
        'X-GNOME-Autostart-enabled=true',
        ''
      ].join('\n')
    )
  })

  it('should quote a path with spaces and escape quotes, backticks, dollars and backslashes', () => {
    const entry = autostartEntry('/home/me/My "Apps"/a`b$c\\d.AppImage')
    expect(entry).toContain('Exec="/home/me/My \\"Apps\\"/a\\`b\\$c\\\\d.AppImage"\n')
  })

  it('should keep a percent sign from being read as a field code', () => {
    expect(autostartEntry('/home/me/100%/talyx')).toContain('Exec="/home/me/100%%/talyx"\n')
  })
})

describe('setLaunchAtLogin on Linux', () => {
  it('should write the autostart entry for the AppImage when enabled', async () => {
    const { deps, files } = fakeDeps()
    await setLaunchAtLogin(true, deps)
    expect(files.get(ENTRY_PATH)).toBe(autostartEntry(APPIMAGE))
  })

  it('should run the installed binary when there is no AppImage', async () => {
    const { deps, files } = fakeDeps({ env: {} })
    await setLaunchAtLogin(true, deps)
    expect(files.get(ENTRY_PATH)).toBe(autostartEntry('/opt/Talyx/talyx'))
  })

  it('should follow XDG_CONFIG_HOME when it is set', async () => {
    const { deps, files } = fakeDeps({ env: { APPIMAGE, XDG_CONFIG_HOME: '/cfg' } })
    await setLaunchAtLogin(true, deps)
    expect([...files.keys()]).toEqual(['/cfg/autostart/talyx.desktop'])
  })

  it('should remove the autostart entry when disabled', async () => {
    const { deps, files } = fakeDeps()
    await setLaunchAtLogin(true, deps)
    await setLaunchAtLogin(false, deps)
    expect(files.size).toBe(0)
  })

  it('should fail with a launch-at-login error when the file cannot be written', async () => {
    const { deps } = fakeDeps()
    deps.fs.writeFile = async () => {
      throw new Error('EACCES')
    }
    await expect(setLaunchAtLogin(true, deps)).rejects.toBeInstanceOf(LaunchAtLoginError)
  })
})

describe('setLaunchAtLogin on macOS', () => {
  it.each([true, false])('should set the login item to %s', async (enabled) => {
    const { deps, loginItem, files } = fakeDeps({ platform: 'darwin' })
    loginItem.openAtLogin = !enabled
    await setLaunchAtLogin(enabled, deps)
    expect(loginItem.openAtLogin).toBe(enabled)
    expect(files.size).toBe(0)
  })

  it('should fail with a launch-at-login error when the system refuses', async () => {
    const { deps } = fakeDeps({ platform: 'darwin' })
    deps.app.setLoginItemSettings = () => {
      throw new Error('denied')
    }
    await expect(setLaunchAtLogin(true, deps)).rejects.toBeInstanceOf(LaunchAtLoginError)
  })
})

describe('without a packaged Linux or macOS app', () => {
  it.each([
    ['in development', { packaged: false }],
    ['on another platform', { platform: 'win32' as const }]
  ])('should change nothing and read off %s', async (_case, overrides) => {
    const { deps, files, loginItem } = fakeDeps(overrides)
    await setLaunchAtLogin(true, deps)
    expect(files.size).toBe(0)
    expect(loginItem.openAtLogin).toBe(false)
    expect(await readLaunchAtLogin(deps)).toBe(false)
  })
})

describe('readLaunchAtLogin', () => {
  it('should read the macOS login item', async () => {
    const { deps, loginItem } = fakeDeps({ platform: 'darwin' })
    expect(await readLaunchAtLogin(deps)).toBe(false)
    loginItem.openAtLogin = true
    expect(await readLaunchAtLogin(deps)).toBe(true)
  })

  it('should read the Linux autostart entry from its presence', async () => {
    const { deps } = fakeDeps()
    expect(await readLaunchAtLogin(deps)).toBe(false)
    await setLaunchAtLogin(true, deps)
    expect(await readLaunchAtLogin(deps)).toBe(true)
  })
})
