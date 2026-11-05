import { BrowserWindow, dialog, ipcMain } from 'electron'
import log from 'electron-log'
import type { EngineStatus } from '../../../shared/engine'
import { createEngine } from '../engine/engine'
import { EngineSockets, type SocketEventSink } from '../engine/engineSockets'
import { settingsStore } from '../storage/SettingsStore'
import {
  EngineHttpRequestSchema,
  EnginePathSchema,
  EngineSocketIdSchema,
  EngineSocketTextSchema,
  ProfileNameSchema,
  validateInput
} from './validation'

const engine = createEngine({ enginePath: () => settingsStore.store.enginePath })
const sockets = new EngineSockets(engine)

/** The IPC sender, or the dev bridge's stand-in (which broadcasts and has no lifecycle). */
interface Sender {
  send: (channel: string, ...args: unknown[]) => void
  isDestroyed: () => boolean
  on?: (event: 'destroyed' | 'did-navigate', listener: () => void) => void
}

/** Open sockets per page, so a reload or a closed window closes exactly that page's sockets. */
const ownedSockets = new WeakMap<Sender, Set<string>>()

// What the engine screen shows the user also goes to the log, where support can read it.
async function loggedStatus(): Promise<EngineStatus> {
  const status = await engine.status()
  if (status.state === 'error') log.warn('[Engine] Could not attach:', status.message)
  if (status.state === 'missing') log.warn('[Engine] Command not found', status.enginePath ?? '')
  return status
}

export function registerEngineIpc(): void {
  ipcMain.handle('engine:status', () => loggedStatus())

  ipcMain.handle('engine:pick-path', async (event): Promise<EngineStatus> => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const options = { title: 'Choose the engine command', properties: ['openFile' as const] }
    const picked = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    if (!picked.canceled && picked.filePaths[0]) {
      settingsStore.set({ enginePath: validateInput(EnginePathSchema, picked.filePaths[0]) })
    }
    return loggedStatus()
  })

  ipcMain.handle('engine:http', (_event, raw: unknown) =>
    engine.http(validateInput(EngineHttpRequestSchema, raw))
  )

  ipcMain.handle(
    'engine:socket-open',
    async (event, rawId: unknown, rawProfile: unknown): Promise<void> => {
      const id = validateInput(EngineSocketIdSchema, rawId)
      const sender = event.sender as Sender
      await sockets.open(id, validateInput(ProfileNameSchema, rawProfile), senderSink(sender))
      ownedBy(sender).add(id)
    }
  )

  ipcMain.handle('engine:socket-send', (_event, rawId: unknown, rawText: unknown) =>
    sockets.send(
      validateInput(EngineSocketIdSchema, rawId),
      validateInput(EngineSocketTextSchema, rawText)
    )
  )

  ipcMain.handle('engine:socket-close', (_event, rawId: unknown) =>
    sockets.close(validateInput(EngineSocketIdSchema, rawId))
  )
}

/** Close every socket Talyx opened; the gateway itself keeps running (it is never ours). */
export function closeEngineSockets(): void {
  sockets.closeAll()
}

/** The page's socket ids; a reload or a closed window leaves no page to read them, so they close. */
function ownedBy(sender: Sender): Set<string> {
  let ids = ownedSockets.get(sender)
  if (!ids) {
    const owned = new Set<string>()
    const closeOwned = (): void => {
      for (const id of owned) sockets.close(id)
      owned.clear()
    }
    // Once per page, not per socket: every redial would otherwise add two more listeners.
    sender.on?.('did-navigate', closeOwned)
    sender.on?.('destroyed', closeOwned)
    ownedSockets.set(sender, owned)
    ids = owned
  }
  return ids
}

function senderSink(sender: Sender): SocketEventSink {
  return (channel, ...args) => {
    if (channel === 'engine:socket-closed') ownedSockets.get(sender)?.delete(args[0] as string)
    if (!sender.isDestroyed()) sender.send(channel, ...args)
  }
}
