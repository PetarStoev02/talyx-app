import { BrowserWindow, dialog, ipcMain } from 'electron'
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
  once?: (event: 'destroyed' | 'did-navigate', listener: () => void) => void
}

export function registerEngineIpc(): void {
  ipcMain.handle('engine:status', (): Promise<EngineStatus> => engine.status())

  ipcMain.handle('engine:pick-path', async (event): Promise<EngineStatus> => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const options = { title: 'Choose the engine command', properties: ['openFile' as const] }
    const picked = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    if (!picked.canceled && picked.filePaths[0]) {
      settingsStore.set({ enginePath: validateInput(EnginePathSchema, picked.filePaths[0]) })
    }
    return engine.status()
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
      // A reload or a closed window leaves no page to read the socket: close it with the page.
      sender.once?.('did-navigate', () => sockets.close(id))
      sender.once?.('destroyed', () => sockets.close(id))
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

function senderSink(sender: Sender): SocketEventSink {
  return (channel, ...args) => {
    if (!sender.isDestroyed()) sender.send(channel, ...args)
  }
}
