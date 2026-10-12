import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('electron', () => {
  const BrowserWindow = vi.fn().mockImplementation(function () {
    return {
      loadURL: vi.fn(),
      loadFile: vi.fn(),
      on: vi.fn(),
      once: vi.fn(),
      show: vi.fn(),
      showInactive: vi.fn(),
      setAlwaysOnTop: vi.fn(),
      hide: vi.fn(),
      focus: vi.fn(),
      isVisible: vi.fn(() => false),
      isFocused: vi.fn(() => false),
      setPosition: vi.fn(),
      webContents: { send: vi.fn(), on: vi.fn(), focus: vi.fn() },
      destroy: vi.fn(),
      isDestroyed: vi.fn(() => false)
    }
  })
  ;(BrowserWindow as unknown as { getAllWindows: ReturnType<typeof vi.fn> }).getAllWindows = vi.fn(
    () => []
  )
  return {
    app: { hide: vi.fn() },
    BrowserWindow,
    globalShortcut: {
      register: vi.fn(() => true),
      unregister: vi.fn(),
      isRegistered: vi.fn(() => false)
    },
    screen: {
      getCursorScreenPoint: vi.fn(() => ({ x: 500, y: 300 })),
      getDisplayNearestPoint: vi.fn(() => ({
        bounds: { x: 0, y: 0, width: 1920, height: 1080 }
      }))
    },
    ipcMain: { on: vi.fn(), handle: vi.fn() },
    nativeTheme: { shouldUseDarkColors: false },
    Notification: vi.fn().mockImplementation(() => ({ show: vi.fn() }))
  }
})

import { AssistantWindowManager } from '../../src/main/infrastructure/assistant/AssistantWindowManager'
import { app, BrowserWindow, globalShortcut } from 'electron'

describe('AssistantWindowManager', () => {
  let manager: AssistantWindowManager

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([])
    manager = new AssistantWindowManager()
  })

  it('should create a glass overlay matching the main window on macOS', () => {
    manager.createWindow('/preload.js')
    expect(BrowserWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        transparent: true,
        hasShadow: false,
        backgroundColor: '#00000000',
        ...(process.platform === 'darwin' ? { vibrancy: 'hud', visualEffectState: 'active' } : {})
      })
    )
  })

  it('should resize the overlay to the measured panel height', () => {
    manager.createWindow('/preload.js')
    const window = manager.getWindow()!
    const setContentSize = vi.fn()
    Object.assign(window, {
      getContentSize: () => [620, 120],
      setContentSize
    })
    manager.fitHeight(214.4)
    expect(setContentSize).toHaveBeenCalledWith(620, 215)
  })

  it('should allow a tall history pane without exceeding the overlay max', () => {
    manager.createWindow('/preload.js')
    const window = manager.getWindow()!
    const setContentSize = vi.fn()
    Object.assign(window, {
      getContentSize: () => [620, 120],
      setContentSize
    })
    manager.fitHeight(720)
    expect(setContentSize).toHaveBeenCalledWith(620, 680)
  })

  it('should show a briefing without taking the keyboard or staying on top', () => {
    manager.createWindow('/preload.js')
    const window = manager.getWindow()!

    manager.showQuietly()

    expect(window.showInactive).toHaveBeenCalledOnce()
    expect(window.show).not.toHaveBeenCalled()
    expect(window.focus).not.toHaveBeenCalled()
    expect(window.setAlwaysOnTop).toHaveBeenCalledWith(false)
    expect(manager.isQuietBriefingVisible()).toBe(true)
  })

  it('should clear the quiet briefing flag when the owner opens the overlay', () => {
    manager.createWindow('/preload.js')

    manager.showQuietly()
    manager.show()

    expect(manager.isQuietBriefingVisible()).toBe(false)
  })

  it('should clear the quiet briefing flag when the overlay hides', () => {
    manager.createWindow('/preload.js')

    manager.showQuietly()
    manager.hideWindowOnly()

    expect(manager.isQuietBriefingVisible()).toBe(false)
  })

  it('should focus a briefing the hotkey lands on, not hide it', () => {
    manager.createWindow('/preload.js')
    const window = manager.getWindow()!
    vi.mocked(window.isVisible).mockReturnValue(true)
    vi.mocked(window.isFocused).mockReturnValue(false)

    manager.toggle()

    expect(window.focus).toHaveBeenCalledOnce()
    expect(window.hide).not.toHaveBeenCalled()
  })

  it('should hide sibling windows when the hotkey opens the overlay alone', () => {
    manager.createWindow('/preload.js')
    const overlay = manager.getWindow()!
    const main = {
      hide: vi.fn(),
      isDestroyed: vi.fn(() => false)
    }
    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([overlay as never, main as never])

    manager.toggle()

    expect(main.hide).toHaveBeenCalledOnce()
    expect(overlay.show).toHaveBeenCalledOnce()
  })

  it('should leave sibling windows alone when show is not exclusive', () => {
    manager.createWindow('/preload.js')
    const overlay = manager.getWindow()!
    const main = {
      hide: vi.fn(),
      isDestroyed: vi.fn(() => false)
    }
    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([overlay as never, main as never])

    manager.show()

    expect(main.hide).not.toHaveBeenCalled()
    expect(overlay.show).toHaveBeenCalledOnce()
  })

  it('should not raise the overlay for an approval while the main window is showing', () => {
    manager.createWindow('/preload.js')
    const overlay = manager.getWindow()!
    const main = {
      isDestroyed: vi.fn(() => false),
      isVisible: vi.fn(() => true),
      isMinimized: vi.fn(() => false)
    }
    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([overlay as never, main as never])

    manager.showForApproval()

    expect(overlay.show).not.toHaveBeenCalled()
  })

  it('should raise the overlay for an approval when the main window is hidden or minimized', () => {
    manager.createWindow('/preload.js')
    const overlay = manager.getWindow()!
    const main = {
      isDestroyed: vi.fn(() => false),
      isVisible: vi.fn(() => true),
      isMinimized: vi.fn(() => true)
    }
    vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([overlay as never, main as never])

    manager.showForApproval()

    expect(overlay.showInactive).toHaveBeenCalledOnce()
    expect(overlay.show).not.toHaveBeenCalled()
    expect(overlay.focus).not.toHaveBeenCalled()
  })

  it('should leave an overlay the owner already has open as it is for an approval', () => {
    manager.createWindow('/preload.js')
    const overlay = manager.getWindow()!
    vi.mocked(overlay.isVisible).mockReturnValue(true)

    manager.showForApproval()

    expect(overlay.show).not.toHaveBeenCalled()
    expect(overlay.showInactive).not.toHaveBeenCalled()
  })

  it('should let the first click on an unfocused overlay press the button', () => {
    manager.createWindow('/preload.js')
    expect(vi.mocked(BrowserWindow).mock.calls[0][0]).toMatchObject({ acceptFirstMouse: true })
  })

  it('should hide the overlay when the hotkey lands on one the owner is using', () => {
    manager.createWindow('/preload.js')
    const window = manager.getWindow()!
    vi.mocked(window.isVisible).mockReturnValue(true)
    vi.mocked(window.isFocused).mockReturnValue(true)

    manager.toggle()

    expect(window.hide).toHaveBeenCalledOnce()
  })

  it('should put the overlay back on top when the owner asks for it', () => {
    manager.createWindow('/preload.js')
    const window = manager.getWindow()!

    manager.showQuietly()
    manager.show()

    expect(window.setAlwaysOnTop).toHaveBeenLastCalledWith(true)
    expect(window.focus).toHaveBeenCalledOnce()
  })

  it('should register the default shortcut', () => {
    const result = manager.registerShortcut()
    expect(result).toBe(true)
    expect(globalShortcut.register).toHaveBeenCalledWith(
      'CommandOrControl+Shift+Space',
      expect.any(Function)
    )
  })

  it('should accept a custom shortcut', () => {
    const custom = new AssistantWindowManager('CommandOrControl+K')
    custom.registerShortcut()
    expect(globalShortcut.register).toHaveBeenCalledWith('CommandOrControl+K', expect.any(Function))
  })

  it('should unregister before updating shortcut', () => {
    manager.registerShortcut()
    vi.mocked(globalShortcut.isRegistered).mockReturnValue(true)
    manager.updateShortcut('CommandOrControl+K')
    expect(globalShortcut.unregister).toHaveBeenCalled()
  })

  it('should not hide on blur while an approval is pending', () => {
    manager.createWindow('/preload.js')
    const win = (BrowserWindow as unknown as ReturnType<typeof vi.fn>).mock.results[0].value
    const blur = win.on.mock.calls.find((c: unknown[]) => c[0] === 'blur')![1] as () => void
    manager.setApprovalPending(true)
    blur()
    expect(win.hide).not.toHaveBeenCalled()
    manager.setApprovalPending(false)
    blur()
    expect(win.hide).toHaveBeenCalled()
  })

  it('should hide only the overlay window without backgrounding the app', () => {
    manager.createWindow('/preload.js')
    const win = (BrowserWindow as unknown as ReturnType<typeof vi.fn>).mock.results[0].value
    manager.hideWindowOnly()
    expect(win.hide).toHaveBeenCalled()
    expect(app.hide).not.toHaveBeenCalled()
  })

  describe('hide', () => {
    const realPlatform = process.platform

    function onDarwin(): void {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
    }

    afterEach(() => {
      Object.defineProperty(process, 'platform', { value: realPlatform, configurable: true })
    })

    it('should not background the app when the overlay was not visible', () => {
      onDarwin()
      manager.createWindow('/preload.js')
      manager.hide()
      expect(app.hide).not.toHaveBeenCalled()
    })

    it('should keep the app up when the main window is showing behind the overlay', () => {
      onDarwin()
      manager.createWindow('/preload.js')
      const overlay = manager.getWindow()!
      ;(overlay.isVisible as ReturnType<typeof vi.fn>).mockReturnValue(true)
      const main = {
        isDestroyed: vi.fn(() => false),
        isVisible: vi.fn(() => true),
        isMinimized: vi.fn(() => false)
      }
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([overlay as never, main as never])
      manager.hide()
      expect(overlay.hide).toHaveBeenCalled()
      expect(app.hide).not.toHaveBeenCalled()
    })

    it('should background the app when the overlay was visible', () => {
      onDarwin()
      manager.createWindow('/preload.js')
      const win = (BrowserWindow as unknown as ReturnType<typeof vi.fn>).mock.results[0].value
      win.isVisible.mockReturnValue(true)
      manager.hide()
      expect(win.hide).toHaveBeenCalled()
      expect(app.hide).toHaveBeenCalled()
    })
  })
})
