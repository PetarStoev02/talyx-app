import { app, BrowserWindow, globalShortcut, screen, Notification } from 'electron'
import { join } from 'path'
import { is } from '../../lib/electronUtils'

const OVERLAY_WIDTH = 620
const OVERLAY_MIN_HEIGHT = 120
/** Room for the composer plus a tall history pane when the transcript has content. */
const OVERLAY_MAX_HEIGHT = 680
const DEFAULT_SHORTCUT = 'CommandOrControl+Shift+Space'
const KILL_SHORTCUT = 'CommandOrControl+Shift+Escape'

export class AssistantWindowManager {
  private window: BrowserWindow | null = null
  private shortcut: string
  private approvalPending = false
  /** True while a pushed briefing is on screen via showQuietly; cleared on show/hide. */
  private quietBriefingVisible = false

  constructor(shortcut?: string) {
    this.shortcut = shortcut ?? DEFAULT_SHORTCUT
  }

  createWindow(preloadPath: string): void {
    console.log(`[Assistant] createWindow called, preload: ${preloadPath}`)
    if (this.window && !this.window.isDestroyed()) return

    this.window = new BrowserWindow({
      width: OVERLAY_WIDTH,
      height: OVERLAY_MIN_HEIGHT,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: true,
      show: false,
      hasShadow: false,
      // The approval card appears without focus; the owner's first click must press the button.
      acceptFirstMouse: true,
      // Exact content size — no empty vibrancy above the panel.
      transparent: true,
      ...(process.platform === 'darwin'
        ? { vibrancy: 'hud' as const, visualEffectState: 'active' as const }
        : {}),
      backgroundColor: '#00000000',
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })

    if (is.dev && process.env.ELECTRON_RENDERER_URL) {
      this.window.loadURL(`${process.env.ELECTRON_RENDERER_URL}/assistant.html`)
    } else {
      this.window.loadFile(join(__dirname, '../renderer/assistant.html'))
    }

    this.window.on('blur', () => {
      if (!this.approvalPending) this.hide()
    })
  }

  registerShortcut(): boolean {
    console.log(`[Assistant] Registering shortcut: ${this.shortcut}`)
    const registered = globalShortcut.register(this.shortcut, () => {
      console.log('[Assistant] Shortcut triggered, toggling overlay')
      this.toggle()
    })

    console.log(`[Assistant] Shortcut registered: ${registered}`)
    if (!registered) {
      new Notification({
        title: 'Talyx',
        body: 'Keyboard shortcut is in use by another app. Change it in Settings.'
      }).show()
    }

    return registered
  }

  unregisterShortcut(): void {
    if (globalShortcut.isRegistered(this.shortcut)) {
      globalShortcut.unregister(this.shortcut)
    }
  }

  updateShortcut(newShortcut: string): boolean {
    this.unregisterShortcut()
    this.shortcut = newShortcut
    return this.registerShortcut()
  }

  /** P0: macOS only, so aborting a run never depends on the overlay having focus. */
  registerKillShortcut(onKill: () => void): void {
    if (process.platform !== 'darwin') return
    const registered = globalShortcut.register(KILL_SHORTCUT, onKill)
    if (!registered) {
      console.warn(`[Assistant] kill shortcut ${KILL_SHORTCUT} could not be registered`)
    }
  }

  toggle(): void {
    console.log(
      `[Assistant] toggle called, window exists: ${!!this.window}, destroyed: ${this.window?.isDestroyed()}, visible: ${this.window?.isVisible()}`
    )
    if (!this.window || this.window.isDestroyed()) return

    // Visible but unfocused means a briefing put it there. The owner reaching
    // for the hotkey then wants to read it, not dismiss it and background Talyx.
    if (this.window.isVisible() && this.window.isFocused()) {
      this.hide()
    } else {
      // Hotkey is Capture-only — never drag the main window along.
      this.show({ exclusive: true })
    }
  }

  /**
   * @param exclusive When true, hide every other BrowserWindow first. Needed on
   *   macOS: after `app.hide()`, activating for the overlay otherwise restores
   *   the main window that was visible when the app was backgrounded.
   */
  show(options?: { exclusive?: boolean }): void {
    if (!this.window || this.window.isDestroyed()) return
    this.quietBriefingVisible = false

    if (options?.exclusive) {
      for (const win of BrowserWindow.getAllWindows()) {
        if (win !== this.window && !win.isDestroyed()) win.hide()
      }
    }

    this.window.setAlwaysOnTop(true)
    this.positionOnActiveDisplay()
    this.window.show()
    this.window.focus()
    this.window.webContents.focus()
    this.window.webContents.send('assistant:focus')
  }

  /**
   * Raises the overlay for an approval without taking the keyboard: the owner may
   * be typing in another app, and a focused card would read their next Enter as
   * "approve". An overlay they already have open, or the Ask page's own card,
   * is left as it is.
   */
  showForApproval(): void {
    if (!this.window || this.window.isDestroyed()) return
    if (this.window.isVisible() || this.mainWindowShowing()) return
    this.window.setAlwaysOnTop(true)
    this.positionOnActiveDisplay()
    this.window.showInactive()
  }

  hide(): void {
    // Hand focus back only when the overlay was the only Talyx window on
    // screen; with the main window showing, app.hide() would take it too.
    const wasVisible = !!this.window && !this.window.isDestroyed() && this.window.isVisible()
    this.hideWindowOnly()
    if (wasVisible && !this.mainWindowShowing() && process.platform === 'darwin') app.hide()
  }

  private mainWindowShowing(): boolean {
    return BrowserWindow.getAllWindows().some(
      (win) => win !== this.window && !win.isDestroyed() && win.isVisible() && !win.isMinimized()
    )
  }

  /**
   * Shows the overlay without taking the keyboard. `show()` focuses the window
   * and its web contents, which is right when the owner asked for it and wrong
   * when a timer did — a briefing at eight would otherwise swallow the sentence
   * they were typing in another app.
   */
  showQuietly(): void {
    if (!this.window || this.window.isDestroyed() || this.window.isVisible()) return
    this.quietBriefingVisible = true
    this.positionOnActiveDisplay()
    // Dropped for this appearance only. Without focus the blur handler never
    // runs, so an always-on-top overlay nobody clicked would cover every other
    // app indefinitely. As an ordinary window it can simply be covered, and
    // show() puts the flag back the moment the owner asks for the overlay.
    this.window.setAlwaysOnTop(false)
    this.window.showInactive()
  }

  /** Hides just the overlay BrowserWindow, without also backgrounding the whole app. */
  hideWindowOnly(): void {
    if (!this.window || this.window.isDestroyed()) return
    this.quietBriefingVisible = false
    this.window.hide()
  }

  isOverlayVisible(): boolean {
    return !!this.window && !this.window.isDestroyed() && this.window.isVisible()
  }

  isQuietBriefingVisible(): boolean {
    return this.quietBriefingVisible
  }

  setApprovalPending(pending: boolean): void {
    this.approvalPending = pending
  }

  /** Resize to the panel's measured height so empty frost never sits above it. */
  fitHeight(height: number): void {
    if (!this.window || this.window.isDestroyed()) return
    const next = Math.min(OVERLAY_MAX_HEIGHT, Math.max(OVERLAY_MIN_HEIGHT, Math.ceil(height)))
    const [, current] = this.window.getContentSize()
    if (current === next) return
    this.window.setContentSize(OVERLAY_WIDTH, next)
  }

  private positionOnActiveDisplay(): void {
    if (!this.window) return

    const cursor = screen.getCursorScreenPoint()
    const display = screen.getDisplayNearestPoint(cursor)
    const { x, y, width, height } = display.bounds

    const windowX = Math.round(x + (width - OVERLAY_WIDTH) / 2)
    const windowY = Math.round(y + height * 0.25)

    this.window.setPosition(windowX, windowY)
  }

  getWindow(): BrowserWindow | null {
    return this.window
  }

  destroy(): void {
    this.unregisterShortcut()
    globalShortcut.unregister(KILL_SHORTCUT)
    if (this.window && !this.window.isDestroyed()) {
      this.window.destroy()
    }
    this.window = null
  }
}
