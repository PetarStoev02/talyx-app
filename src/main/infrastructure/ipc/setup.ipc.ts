import { ipcMain } from 'electron'
import log from 'electron-log'
import type { InstallExit, InstallSteps } from '../../../shared/setup'
import { loginShell, runInstall, type InstallRun } from '../setup/installRunner'
import { installStepsSource, loadInstallSteps } from '../setup/installSteps'

/** The IPC sender, or the dev bridge's stand-in (which broadcasts and has no lifecycle). */
interface Sender {
  send: (channel: string, ...args: unknown[]) => void
  isDestroyed: () => boolean
  on?: (event: 'destroyed' | 'did-navigate', listener: () => void) => void
}

interface RunningInstall {
  owner: Sender
  run: InstallRun
}

// The renderer never sends commands: the install runs what main itself loaded and pinned.
let readyCommands: string[] | null = null
let running: RunningInstall | null = null
const watchedPages = new WeakSet<Sender>()

export function registerSetupIpc(): void {
  ipcMain.handle('setup:install-steps', async (): Promise<InstallSteps> => {
    const steps = await loadInstallSteps(installStepsSource())
    readyCommands = steps.kind === 'ready' ? steps.commands : null
    return steps
  })

  ipcMain.handle('setup:install-run', (event): void => startInstall(event.sender as Sender))

  ipcMain.handle('setup:install-cancel', (event): void => {
    if (running?.owner === (event.sender as Sender)) running.run.cancel()
  })
}

/** Stop a running install, e.g. when Talyx quits; a no-op when none runs. */
export function cancelInstall(): void {
  running?.run.cancel()
}

function startInstall(owner: Sender): void {
  if (running) throw new Error('An install is already running')
  if (!readyCommands) throw new Error('Load the install steps first')

  const run = runInstall(
    readyCommands,
    (index, text) => emit(owner, 'setup:install-output', index, text),
    loginShell()
  )
  const started: RunningInstall = { owner, run }
  running = started
  cancelWhenGone(owner)

  void run.done.then(
    (exit) => finish(started, exit),
    (error: unknown) => {
      log.warn('[Setup] The install run failed unexpectedly:', error)
      finish(started, { kind: 'failed', index: 0, code: 1 })
    }
  )
}

function finish(started: RunningInstall, exit: InstallExit): void {
  if (running === started) running = null
  emit(started.owner, 'setup:install-exit', exit)
}

/** A reload or a closed window leaves no page to watch the install, so it stops. */
function cancelWhenGone(owner: Sender): void {
  if (watchedPages.has(owner)) return
  watchedPages.add(owner)
  const cancelIfOwner = (): void => {
    if (running?.owner === owner) running.run.cancel()
  }
  owner.on?.('did-navigate', cancelIfOwner)
  owner.on?.('destroyed', cancelIfOwner)
}

// Never throws: it runs inside a child-process stream handler, where a throw is uncaught.
function emit(sender: Sender, channel: string, ...args: unknown[]): void {
  if (sender.isDestroyed()) return
  try {
    sender.send(channel, ...args)
  } catch (error) {
    log.warn('[Setup] Could not send to the page:', error)
  }
}
