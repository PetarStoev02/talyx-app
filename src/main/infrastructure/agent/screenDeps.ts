import { BrowserWindow, desktopCapturer, screen, shell, systemPreferences } from 'electron'
import log from 'electron-log'
import type { ScreenDeps, Screenshot } from '../../domain/instruction/capabilities/screen'
import type { Modifier } from '../../domain/instruction/capabilities/keyChords'
import {
  AccessibilityPermissionError,
  ScreenCaptureError,
  ScreenRecordingPermissionError,
  TalyxHasFocusError
} from '../../domain/instruction/model/errors'
import { runJxa } from './appleScript'

/** The low end of Anthropic's recommended screenshot size keeps clicks accurate and images cheap. */
const MAX_LONG_EDGE = 1280
const JPEG_QUALITY = 80
/** After the card, app.hide() hands focus back; input sent before that lands on Talyx. */
const FOCUS_WAIT_MS = 500
const FOCUS_POLL_MS = 25
const SCREEN_RECORDING_PANE =
  'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'

/** Keys the shape of which matters more than the character: Return and Tab. */
const KEY_CODE_FOR_CHAR: Record<string, number> = { '\n': 36, '\t': 48 }

/** CGEventFlags masks. */
const MODIFIER_FLAGS: Record<Modifier, number> = {
  shift: 0x20000,
  ctrl: 0x40000,
  alt: 0x80000,
  cmd: 0x100000
}

/**
 * Posts CoreGraphics events through osascript's ObjC bridge, so screen control needs
 * no native addon. macOS drops them silently unless Talyx has Accessibility access,
 * which is why every input call checks first. Characters are sent one UTF-16 unit
 * per event, so emoji outside the BMP do not type (ponytail: paste them through the
 * pasteboard if that matters).
 */
const INPUT_SCRIPT = `
ObjC.import('CoreGraphics')
function run(argv) {
  const cmd = JSON.parse(argv[0])
  const post = (event) => $.CGEventPost(0, event)
  const mouse = (type, button, clicks) => {
    const event = $.CGEventCreateMouseEvent($(), type, $.CGPointMake(cmd.x, cmd.y), button)
    if (clicks) $.CGEventSetIntegerValueField(event, 1, clicks)
    post(event)
  }
  const key = (code, down, flags, unit) => {
    const event = $.CGEventCreateKeyboardEvent($(), code, down)
    $.CGEventSetFlags(event, flags)
    if (unit !== undefined) {
      const ref = Ref('S')
      ref[0] = unit
      $.CGEventKeyboardSetUnicodeString(event, 1, ref)
    }
    post(event)
  }
  if (cmd.kind === 'click') {
    const right = cmd.button === 'right'
    mouse(5, 0, 0)
    delay(0.05)
    for (let i = 1; i <= cmd.clicks; i++) {
      mouse(right ? 3 : 1, right ? 1 : 0, i)
      mouse(right ? 4 : 2, right ? 1 : 0, i)
    }
  } else if (cmd.kind === 'scroll') {
    mouse(5, 0, 0)
    delay(0.05)
    post($.CGEventCreateScrollWheelEvent2($(), 1, 2, cmd.dy, cmd.dx, 0))
  } else if (cmd.kind === 'press') {
    key(cmd.keyCode, true, cmd.flags)
    key(cmd.keyCode, false, cmd.flags)
  } else if (cmd.kind === 'type') {
    for (let i = 0; i < cmd.text.length; i++) {
      const code = cmd.keyCodes[cmd.text[i]]
      const unit = code === undefined ? cmd.text.charCodeAt(i) : undefined
      key(code ?? 0, true, 0, unit)
      key(code ?? 0, false, 0, unit)
      delay(0.004)
    }
  }
  return JSON.stringify(true)
}
`

type InputCommand =
  | { kind: 'click'; x: number; y: number; button: string; clicks: number }
  | { kind: 'scroll'; x: number; y: number; dx: number; dy: number }
  | { kind: 'press'; keyCode: number; flags: number }
  | { kind: 'type'; text: string; keyCodes: Record<string, number> }

export function screenDeps(): ScreenDeps {
  return {
    capture,
    click: (at, button, clicks) => drive({ kind: 'click', ...at, button, clicks }),
    type: (text, signal) => driveKeys({ kind: 'type', text, keyCodes: KEY_CODE_FOR_CHAR }, signal),
    press: (chord) =>
      driveKeys({
        kind: 'press',
        keyCode: chord.keyCode,
        flags: chord.modifiers.reduce((flags, m) => flags | MODIFIER_FLAGS[m], 0)
      }),
    scroll: (at, direction, amount) =>
      drive({
        kind: 'scroll',
        ...at,
        // Wheel units: positive is up / left, the way a physical wheel reports.
        dy: direction === 'up' ? amount : direction === 'down' ? -amount : 0,
        dx: direction === 'left' ? amount : direction === 'right' ? -amount : 0
      }),
    now: () => new Date()
  }
}

/** The display the cursor is on — the one the overlay opened on, and the one the owner is looking at. */
async function capture(): Promise<Screenshot> {
  // No early status check: macOS 10.15+ reports 'denied' before the first ask, and only the
  // capture attempt below registers Talyx in the Screen Recording list and shows the prompt.
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const fit = Math.min(1, MAX_LONG_EDGE / Math.max(display.size.width, display.size.height))
  const thumbnailSize = {
    width: Math.round(display.size.width * fit),
    height: Math.round(display.size.height * fit)
  }
  // Every Talyx window is kept out of the picture, so the model never sees or clicks Talyx.
  // ponytail: toggled per capture so Talyx still shows in the owner's own recordings.
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) win.setContentProtection(true)
  let sources: Electron.DesktopCapturerSource[] = []
  try {
    // This call is what makes macOS ask (and list Talyx) the first time.
    sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize })
  } catch (err) {
    // While denied, macOS 26 rejects here instead of answering empty thumbnails.
    // The status check below turns that into the permission error the owner can act on.
    log.warn('[screen] getSources failed', err)
  } finally {
    for (const win of windows) if (!win.isDestroyed()) win.setContentProtection(false)
  }
  if (systemPreferences.getMediaAccessStatus('screen') !== 'granted') throw await screenDenied()

  // No fallback to another display: its picture would not match the scale below.
  const source = sources.find((s) => s.display_id === String(display.id))
  if (!source) throw new ScreenCaptureError()
  if (source.thumbnail.isEmpty()) throw await screenDenied()
  const size = source.thumbnail.getSize()
  return {
    image: {
      mediaType: 'image/jpeg',
      base64: source.thumbnail.toJPEG(JPEG_QUALITY).toString('base64')
    },
    origin: { x: display.bounds.x, y: display.bounds.y },
    width: size.width,
    height: size.height,
    scale: size.width / display.size.width
  }
}

/** Opens the pane the owner has to flip, then answers with the error to throw. */
async function screenDenied(): Promise<ScreenRecordingPermissionError> {
  await shell.openExternal(SCREEN_RECORDING_PANE)
  return new ScreenRecordingPermissionError()
}

/** A click may land on Talyx: it is on screen, and the click itself moves focus. */
async function drive(command: InputCommand): Promise<void> {
  assertMayDrive()
  await focusLeftTalyx()
  await post(command)
}

/** Keys go wherever focus is, so they must never go to Talyx. */
async function driveKeys(command: InputCommand, signal?: AbortSignal): Promise<void> {
  assertMayDrive()
  if (!(await focusLeftTalyx())) throw new TalyxHasFocusError()
  await post(command, signal)
}

function assertMayDrive(): void {
  // true: macOS shows its own "allow Talyx to control this computer" prompt.
  if (!systemPreferences.isTrustedAccessibilityClient(true))
    throw new AccessibilityPermissionError()
}

/** The signal is the kill switch: aborting kills osascript, so a long text stops within a keystroke. */
async function post(command: InputCommand, signal?: AbortSignal): Promise<void> {
  await runJxa<boolean>(INPUT_SCRIPT, [JSON.stringify(command)], undefined, signal)
}

/** True once no Talyx window has focus; false when one still does after the wait. */
async function focusLeftTalyx(): Promise<boolean> {
  for (let waited = 0; waited < FOCUS_WAIT_MS; waited += FOCUS_POLL_MS) {
    if (!BrowserWindow.getFocusedWindow()) return true
    await new Promise((resolve) => setTimeout(resolve, FOCUS_POLL_MS))
  }
  return !BrowserWindow.getFocusedWindow()
}
