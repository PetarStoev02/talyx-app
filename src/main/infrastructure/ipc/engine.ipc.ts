import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import log from 'electron-log'
import type { EngineHttpRequest, EngineStatus } from '../../../shared/engine'
import { EngineHttpError, createEngine, userBinEngine } from '../engine/engine'
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

const MEDIA_PATH = '/api/media'

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

  // The file the install steps link, chosen explicitly: an older copy earlier on PATH must not win.
  // It takes no argument, so a page can only point Talyx at this one file.
  ipcMain.handle('engine:use-installed', async (): Promise<EngineStatus> => {
    const installed = userBinEngine(process.platform, homedir())
    if (!existsSync(installed)) throw new Error('No installed engine found')
    settingsStore.set({ enginePath: installed })
    return loggedStatus()
  })

  ipcMain.handle('engine:http', (_event, raw: unknown) =>
    engineHttp(validateInput(EngineHttpRequestSchema, raw))
  )

  ipcMain.handle(
    'engine:socket-open',
    async (event, rawId: unknown, rawProfile: unknown): Promise<void> => {
      const id = validateInput(EngineSocketIdSchema, rawId)
      const sender = event.sender as Sender
      const profile = validateInput(ProfileNameSchema, rawProfile)
      // Owned from the start, so a close sent while it opens still reaches it. A reused id is
      // refused by open and stays with the page that already had it.
      const owned = ownedBy(sender)
      const fresh = !owned.has(id)
      owned.add(id)
      await sockets.open(id, profile, senderSink(sender)).catch((error: unknown) => {
        if (fresh) owned.delete(id)
        throw error
      })
    }
  )

  ipcMain.handle('engine:socket-send', (event, rawId: unknown, rawText: unknown) =>
    sockets.send(
      ownSocket(event.sender as Sender, rawId),
      validateInput(EngineSocketTextSchema, rawText)
    )
  )

  // Closing a socket that already closed (or was never this page's) is a no-op, as before.
  ipcMain.handle('engine:socket-close', (event, rawId: unknown) => {
    const id = validateInput(EngineSocketIdSchema, rawId)
    if (owns(event.sender as Sender, id)) sockets.close(id)
  })
}

/** Close every socket Talyx opened; the gateway itself keeps running (it is never ours). */
export function closeEngineSockets(): void {
  sockets.closeAll()
}

/** A page reaches only the sockets it opened, never another window's. */
function ownSocket(sender: Sender, rawId: unknown): string {
  const id = validateInput(EngineSocketIdSchema, rawId)
  if (!owns(sender, id)) throw new Error('Engine socket is not open')
  return id
}

function owns(sender: Sender, id: string): boolean {
  return ownedSockets.get(sender)?.has(id) ?? false
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

// A transcript image the engine has since cleared from its cache answers 404. That is expected,
// and the chat shows the file's name instead, so it resolves null rather than reaching Electron's
// error log as a failed handler.
async function engineHttp(request: EngineHttpRequest): Promise<unknown> {
  try {
    return await engine.http(request)
  } catch (error) {
    if (error instanceof EngineHttpError && error.status === 404 && isMediaRead(request.path))
      return null
    logFailedRequest(request, error)
    throw error
  }
}

// Path and status only: bodies and queries can hold keys, codes and chat text.
function logFailedRequest(request: EngineHttpRequest, error: unknown): void {
  const status =
    error instanceof EngineHttpError
      ? error.status
      : error instanceof Error
        ? error.name
        : 'unknown error'
  const path = new URL(request.path, 'http://engine').pathname
  log.warn('[Engine] Request failed:', request.method ?? 'GET', path, status)
}

function isMediaRead(path: string): boolean {
  return new URL(path, 'http://engine').pathname === MEDIA_PATH
}
