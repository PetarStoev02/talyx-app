import { describe, expect, it, vi } from 'vitest'
import {
  openInstaller,
  type OpenInstallerDeps
} from '../../../src/main/infrastructure/updater/openInstaller'

const FILE = '/home/me/downloads/Talyx-x64.AppImage'

function fakeDeps(platform: NodeJS.Platform, openError = ''): OpenInstallerDeps {
  return {
    platform,
    shell: { openPath: vi.fn(async () => openError), showItemInFolder: vi.fn() },
    chmod: vi.fn(async () => undefined)
  }
}

describe('openInstaller', () => {
  it('should make a Linux AppImage executable, then show it in its folder', async () => {
    const deps = fakeDeps('linux')
    await openInstaller(FILE, deps)

    expect(deps.chmod).toHaveBeenCalledWith(FILE, 0o755)
    expect(deps.shell.showItemInFolder).toHaveBeenCalledWith(FILE)
    expect(deps.shell.openPath).not.toHaveBeenCalled()
  })

  it('should not show a Linux file it could not make executable', async () => {
    const deps = fakeDeps('linux')
    vi.mocked(deps.chmod).mockRejectedValueOnce(new Error('EPERM'))

    await expect(openInstaller(FILE, deps)).rejects.toThrow('EPERM')
    expect(deps.shell.showItemInFolder).not.toHaveBeenCalled()
  })

  it('should open an installer elsewhere with the system, leaving its mode alone', async () => {
    const deps = fakeDeps('darwin')
    await openInstaller('/Users/me/Downloads/Talyx.dmg', deps)

    expect(deps.shell.openPath).toHaveBeenCalledWith('/Users/me/Downloads/Talyx.dmg')
    expect(deps.chmod).not.toHaveBeenCalled()
  })

  it('should fail when the system cannot open the installer', async () => {
    const deps = fakeDeps('win32', 'No application is associated')
    await expect(openInstaller('C:\\Talyx.exe', deps)).rejects.toThrow('could not be opened')
  })
})
