import { execFile } from 'child_process'
import { existsSync } from 'fs'
import { stat } from 'fs/promises'
import { homedir } from 'os'
import { basename, join } from 'path'
import type { ImageFormat } from '../../domain/instruction/capabilities/files'
import type {
  MusicAction,
  RecentFile,
  Screenshot
} from '../../domain/instruction/capabilities/desktop'
import type { MailMessage } from '../../domain/instruction/model/Capability'
import { TargetExistsError } from '../../domain/agent/errors'
import { runJxa } from './appleScript'

const SIPS_FORMAT: Record<ImageFormat, string> = { jpg: 'jpeg', png: 'png', pdf: 'pdf' }
/** Folders whose files are never "something you were working on". */
const RECENT_EXCLUDED = /\/(Library|node_modules|\.git|\.Trash)\//

const DARK_MODE = `
function run(argv) {
  Application('System Events').appearancePreferences.darkMode = argv[0] === 'true'
  return JSON.stringify({ ok: true })
}`
const MUSIC = `
function run(argv) {
  const action = argv[0]; const query = argv[1]
  const app = Application('Music')
  if (action === 'play' && query) {
    const hits = app.search(app.libraryPlaylists[0], { for: query })
    if (hits.length === 0) return JSON.stringify({ playing: '' })
    hits[0].play()
  } else if (action === 'play') app.play()
  else if (action === 'pause') app.pause()
  else if (action === 'next') app.nextTrack()
  else app.previousTrack()
  try {
    const t = app.currentTrack()
    return JSON.stringify({ playing: t.artist() + ' — ' + t.name() })
  } catch (e) {
    return JSON.stringify({ playing: '' })
  }
}`
const UNREAD_MAIL = `
function run(argv) {
  const limit = Number(argv[0])
  const app = Application('Mail')
  const unread = app.inbox().messages.whose({ readStatus: false })()
  return JSON.stringify(unread.slice(0, limit).map((m) => ({
    from: m.sender(),
    subject: m.subject(),
    receivedAt: m.dateReceived().toISOString(),
    preview: (m.content() || '').replace(/\\s+/g, ' ').trim().slice(0, 120)
  })))
}`

/** Real macOS behind the desktop abilities: sips, osascript, networksetup, Spotlight. */
export function desktopDeps(): {
  convertImage(sourcePath: string, targetPath: string, format: ImageFormat): Promise<void>
  setDarkMode(on: boolean): Promise<void>
  setWifi(on: boolean): Promise<void>
  setMuted(on: boolean): Promise<void>
  volume(): Promise<number>
  setVolume(percent: number): Promise<void>
  recentFiles(sinceHours: number, limit: number): Promise<RecentFile[]>
  latestScreenshot(): Promise<Screenshot | null>
  music(action: MusicAction, query: string | null): Promise<string>
  unreadMessages(limit: number): Promise<MailMessage[]>
} {
  return {
    async convertImage(sourcePath, targetPath, format) {
      if (existsSync(targetPath)) throw new TargetExistsError(targetPath)
      await exec('sips', ['-s', 'format', SIPS_FORMAT[format], sourcePath, '--out', targetPath])
    },
    async setDarkMode(on) {
      await runJxa(DARK_MODE, [String(on)])
    },
    async setWifi(on) {
      await exec('networksetup', ['-setairportpower', 'en0', on ? 'on' : 'off'])
    },
    async setMuted(on) {
      await exec('osascript', ['-e', `set volume output muted ${on}`])
    },
    async volume() {
      const out = await exec('osascript', ['-e', 'output volume of (get volume settings)'])
      return Number.parseInt(out.trim(), 10)
    },
    async setVolume(percent) {
      await exec('osascript', ['-e', `set volume output volume ${percent}`])
    },
    async recentFiles(sinceHours, limit) {
      const query = `kMDItemLastUsedDate >= $time.now(-${sinceHours * 3600}) && kMDItemContentTypeTree != "public.folder"`
      const out = await exec('mdfind', ['-onlyin', homedir(), query])
      const paths = out.split('\n').filter((p) => p.length > 0 && !RECENT_EXCLUDED.test(p))
      const withDates = await Promise.all(
        paths.slice(0, limit * 3).map(async (path) => ({
          path,
          name: basename(path),
          lastUsedAt: await lastUsed(path)
        }))
      )
      return withDates
        .filter((f): f is RecentFile => f.lastUsedAt !== null)
        .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
        .slice(0, limit)
    },
    async music(action, query) {
      const { playing } = await runJxa<{ playing: string }>(MUSIC, [action, query ?? ''])
      return playing
    },
    async latestScreenshot() {
      const folder = await screenshotFolder()
      // ponytail: stats every screenshot in the folder to find the newest. Fine for
      // the hundreds a Desktop holds; narrow the Spotlight query by date if it crawls.
      const out = await exec('mdfind', ['-onlyin', folder, 'kMDItemIsScreenCapture == 1'])
      const paths = out.split('\n').filter(Boolean)
      if (paths.length === 0) return null
      const shots = (
        await Promise.all(
          paths.map(async (path) => {
            try {
              const { birthtime } = await stat(path)
              return { path, name: basename(path), takenAt: birthtime.toISOString() }
            } catch {
              // Spotlight still lists a screenshot the owner has already deleted.
              return null
            }
          })
        )
      ).filter((shot): shot is Screenshot => shot !== null)
      if (shots.length === 0) return null
      return shots.reduce((newest, shot) => (shot.takenAt > newest.takenAt ? shot : newest))
    },
    unreadMessages: (limit) => runJxa<MailMessage[]>(UNREAD_MAIL, [String(limit)])
  }
}

/** Where screen captures land — the Desktop unless the owner moved them. */
async function screenshotFolder(): Promise<string> {
  try {
    const out = await exec('defaults', ['read', 'com.apple.screencapture', 'location'])
    const folder = out.trim().replace(/^~/, homedir())
    if (folder && existsSync(folder)) return folder
  } catch {
    // Never set, which is the common case: the Desktop it is.
  }
  return join(homedir(), 'Desktop')
}

async function lastUsed(path: string): Promise<string | null> {
  const out = await exec('mdls', ['-name', 'kMDItemLastUsedDate', '-raw', path])
  const date = new Date(out.trim().replace(' +0000', 'Z').replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function exec(file: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { timeout: 15_000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) =>
      err
        ? reject(
            new Error(typeof stderr === 'string' && stderr.trim() ? stderr.trim() : err.message)
          )
        : resolve(String(stdout))
    )
  })
}
