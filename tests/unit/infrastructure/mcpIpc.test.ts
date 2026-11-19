import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Handler = (event: unknown, ...args: unknown[]) => unknown

const handlers = new Map<string, Handler>()
const userData = { dir: '' }
// The next readFileSync of the key file throws this, as a disk or permission fault would.
const readFault = vi.hoisted(() => ({ code: null as string | null }))
const listen = vi.hoisted(() => vi.fn())

vi.mock('electron', () => ({
  app: { getPath: () => userData.dir, getVersion: () => '9.9.9' },
  ipcMain: { handle: (channel: string, fn: Handler) => handlers.set(channel, fn) }
}))
vi.mock('electron-log', () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))
vi.mock('node:http', () => ({ createServer: () => ({ on: vi.fn(), listen }) }))
vi.mock('node:fs', async (original) => {
  const fs = await original<typeof import('node:fs')>()
  const readFileSync = ((path: string, ...rest: unknown[]) => {
    if (readFault.code && String(path).endsWith('mcp-token')) {
      throw Object.assign(new Error(readFault.code), { code: readFault.code })
    }
    return (fs.readFileSync as (...args: unknown[]) => unknown)(path, ...rest)
  }) as typeof fs.readFileSync
  return { ...fs, readFileSync }
})

const KEY_FILE = (): string => join(userData.dir, 'mcp-token')
const SAVED_KEY = 'a'.repeat(64)

/** A fresh main process: the key is read again, as on a restart. */
async function startMain(): Promise<{ connection: () => Promise<unknown>; start: () => void }> {
  vi.resetModules()
  handlers.clear()
  const mcp = await import('../../../src/main/infrastructure/ipc/mcp.ipc')
  mcp.registerMcpIpc()
  return {
    connection: async () => handlers.get('mcp:connection')!({}),
    start: mcp.startMcpServer
  }
}

describe('the MCP key', () => {
  beforeEach(() => {
    userData.dir = mkdtempSync(join(tmpdir(), 'talyx-mcp-'))
    readFault.code = null
    listen.mockClear()
  })
  afterEach(() => rmSync(userData.dir, { recursive: true, force: true }))

  it('should make a key on the first start and keep it across restarts', async () => {
    const first = (await (await startMain()).connection()) as { token: string }
    const second = (await (await startMain()).connection()) as { token: string }
    expect(first.token).toMatch(/^[0-9a-f]{64}$/)
    expect(second.token).toBe(first.token)
    expect(readFileSync(KEY_FILE(), 'utf8')).toBe(first.token)
  })

  it('should never replace a saved key that could not be read', async () => {
    writeFileSync(KEY_FILE(), SAVED_KEY)
    readFault.code = 'EIO'
    const main = await startMain()
    await expect(main.connection()).rejects.toThrow()
    readFault.code = null
    expect(readFileSync(KEY_FILE(), 'utf8')).toBe(SAVED_KEY)
  })

  it('should start Talyx without the MCP server when the key cannot be read', async () => {
    writeFileSync(KEY_FILE(), SAVED_KEY)
    readFault.code = 'EACCES'
    const main = await startMain()
    expect(() => main.start()).not.toThrow()
    expect(listen).not.toHaveBeenCalled()
  })

  it('should start Talyx without the MCP server when no key can be saved', async () => {
    userData.dir = join(userData.dir, 'gone')
    const main = await startMain()
    expect(() => main.start()).not.toThrow()
    expect(listen).not.toHaveBeenCalled()
  })

  it('should give the saved key once it can be read again', async () => {
    writeFileSync(KEY_FILE(), SAVED_KEY)
    readFault.code = 'EIO'
    const main = await startMain()
    await expect(main.connection()).rejects.toThrow()
    readFault.code = null
    expect(await main.connection()).toMatchObject({ token: SAVED_KEY })
  })
})
