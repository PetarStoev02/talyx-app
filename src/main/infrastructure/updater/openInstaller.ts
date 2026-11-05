import { ReleaseDownloadError } from './releaseDownload'

const EXECUTABLE_MODE = 0o755

/** What opening an installer touches, injected so tests never reach the real OS. */
export interface OpenInstallerDeps {
  platform: NodeJS.Platform
  shell: {
    openPath: (path: string) => Promise<string>
    showItemInFolder: (path: string) => void
  }
  chmod: (path: string, mode: number) => Promise<void>
}

/**
 * Talyx is unsigned and cannot replace itself: the user runs the installer. A Linux AppImage is
 * the app itself, so it is made executable (the download is not) and shown in its folder.
 */
export async function openInstaller(file: string, deps: OpenInstallerDeps): Promise<void> {
  if (deps.platform === 'linux') {
    await deps.chmod(file, EXECUTABLE_MODE)
    return deps.shell.showItemInFolder(file)
  }
  if (await deps.shell.openPath(file))
    throw new ReleaseDownloadError('other', 'The installer could not be opened')
}
