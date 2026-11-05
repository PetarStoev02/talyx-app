import { app } from 'electron'
import { access, mkdir, rm, writeFile } from 'fs/promises'
import { homedir } from 'os'
import { dirname, join } from 'path'

/** Everything the login item touches, injected so tests never reach the real OS. */
export interface LoginItemDeps {
  platform: NodeJS.Platform
  /** A dev run never registers itself: it is not the installed app. */
  packaged: boolean
  env: NodeJS.ProcessEnv
  execPath: string
  homedir: string
  app: {
    setLoginItemSettings: (settings: { openAtLogin: boolean }) => void
    getLoginItemSettings: () => { openAtLogin: boolean }
  }
  fs: {
    mkdir: (path: string) => Promise<unknown>
    writeFile: (path: string, text: string) => Promise<void>
    rm: (path: string) => Promise<void>
    exists: (path: string) => Promise<boolean>
  }
}

/** The OS refused to change whether Talyx starts at login. */
export class LaunchAtLoginError extends Error {
  constructor(cause: unknown) {
    super('Talyx could not change whether it starts at login', { cause })
    this.name = 'LaunchAtLoginError'
  }
}

export function systemLoginItemDeps(): LoginItemDeps {
  return {
    platform: process.platform,
    packaged: app.isPackaged,
    env: process.env,
    execPath: process.execPath,
    homedir: homedir(),
    app,
    fs: {
      mkdir: (path) => mkdir(path, { recursive: true }),
      writeFile: (path, text) => writeFile(path, text),
      rm: (path) => rm(path, { force: true }),
      exists: (path) =>
        access(path).then(
          () => true,
          () => false
        )
    }
  }
}

/** The Desktop Entry spec's quoting for an `Exec` argument, plus `%%` so a literal `%` is not a field code. */
function quoteExec(path: string): string {
  return `"${path.replace(/[\\"`$]/g, '\\$&').replace(/%/g, '%%')}"`
}

/** The `.desktop` file a Linux session runs at login. */
export function autostartEntry(execPath: string): string {
  return [
    '[Desktop Entry]',
    'Type=Application',
    'Name=Talyx',
    `Exec=${quoteExec(execPath)}`,
    'X-GNOME-Autostart-enabled=true',
    ''
  ].join('\n')
}

function entryPath(deps: LoginItemDeps): string {
  const configHome = deps.env.XDG_CONFIG_HOME || join(deps.homedir, '.config')
  return join(configHome, 'autostart', 'talyx.desktop')
}

async function setOnLinux(enabled: boolean, deps: LoginItemDeps): Promise<void> {
  const path = entryPath(deps)
  if (!enabled) return deps.fs.rm(path)
  await deps.fs.mkdir(dirname(path))
  await deps.fs.writeFile(path, autostartEntry(deps.env.APPIMAGE || deps.execPath))
}

export async function setLaunchAtLogin(enabled: boolean, deps: LoginItemDeps): Promise<void> {
  if (!deps.packaged) return
  try {
    if (deps.platform === 'darwin') deps.app.setLoginItemSettings({ openAtLogin: enabled })
    else if (deps.platform === 'linux') await setOnLinux(enabled, deps)
  } catch (error) {
    throw new LaunchAtLoginError(error)
  }
}

/** What the OS does today, which a hand-removed login item or autostart entry can differ from. */
export async function readLaunchAtLogin(deps: LoginItemDeps): Promise<boolean> {
  if (!deps.packaged) return false
  if (deps.platform === 'darwin') return deps.app.getLoginItemSettings().openAtLogin
  if (deps.platform === 'linux') return deps.fs.exists(entryPath(deps))
  return false
}
