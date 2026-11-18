import { EventEmitter } from 'node:events'
import type { BrowserWindow } from 'electron'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const electron = vi.hoisted(() => ({
  dialog: { showMessageBox: vi.fn() },
  app: { quit: vi.fn() }
}))
vi.mock('electron', () => electron)
vi.mock('electron-log', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    transports: { file: { getFile: () => ({ path: '/logs/main.log' }) } }
  }
}))

import {
  showWhenReady,
  watchWindowFailures,
  WINDOW_SHOW_TIMEOUT_MS
} from '../../src/main/lib/windowFailures'

/** A window as Electron hands it over: its own events, its page's events, shown or not. */
class FakeWindow extends EventEmitter {
  readonly webContents = new EventEmitter()
  visible = false
  closed = false
  isDestroyed(): boolean {
    return this.closed
  }
  isVisible(): boolean {
    return this.visible
  }
  show(): void {
    this.visible = true
  }
  close(): void {
    this.closed = true
  }
}

const asWindow = (win: FakeWindow): BrowserWindow => win as unknown as BrowserWindow

const loadFailure = (code: number, isMainFrame: boolean) => (win: FakeWindow) =>
  win.webContents.emit('did-fail-load', {}, code, 'ERR', 'app://talyx/index.html', isMainFrame)

describe('the main window', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    electron.dialog.showMessageBox.mockResolvedValue({ response: 0 })
  })

  afterEach(() => vi.useRealTimers())

  describe('given a page that fails', () => {
    it.each([
      ['fails to load', loadFailure(-105, true)],
      [
        'loses its renderer',
        (win: FakeWindow) => win.webContents.emit('render-process-gone', {}, { reason: 'crashed' })
      ]
    ])('should never sit blank: a page that %s is offered a reload', async (_case, fail) => {
      const win = new FakeWindow()
      const reload = vi.fn()
      watchWindowFailures(asWindow(win), reload)
      fail(win)
      await vi.waitFor(() => expect(reload).toHaveBeenCalledOnce())
      expect(electron.app.quit).not.toHaveBeenCalled()
    })

    it.each([
      ['a load cut short by another navigation', loadFailure(-3, true)],
      ['a frame inside the page', loadFailure(-105, false)]
    ])('should not offer a reload for %s', async (_case, fail) => {
      const win = new FakeWindow()
      watchWindowFailures(asWindow(win), vi.fn())
      fail(win)
      await Promise.resolve()
      expect(electron.dialog.showMessageBox).not.toHaveBeenCalled()
    })
  })

  describe('given a splash on screen', () => {
    function opening(): { win: FakeWindow; splash: FakeWindow } {
      vi.useFakeTimers({ toFake: ['setTimeout'] })
      const win = new FakeWindow()
      const splash = Object.assign(new FakeWindow(), { visible: true })
      showWhenReady(asWindow(win), asWindow(splash))
      return { win, splash }
    }

    it('should swap the splash for the window as soon as the window is ready', () => {
      const { win, splash } = opening()
      win.emit('ready-to-show')
      expect(win.visible).toBe(true)
      expect(splash.closed).toBe(true)
    })

    it('should never leave the user with only the splash when ready-to-show never fires', () => {
      const { win, splash } = opening()
      vi.advanceTimersByTime(WINDOW_SHOW_TIMEOUT_MS)
      expect(win.visible).toBe(true)
      expect(splash.closed).toBe(true)
    })
  })
})
