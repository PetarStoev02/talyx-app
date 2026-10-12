import { z } from 'zod/v4'
import type { Capability, Proposal } from '../model/Capability'
import type { Effect } from '../model/Effect'
import { resolveFolder } from '../model/resolveFolder'

export interface RecentFile {
  path: string
  name: string
  /** ISO 8601. */
  lastUsedAt: string
}

export interface Screenshot {
  path: string
  name: string
  /** ISO 8601. */
  takenAt: string
}

export type MusicAction = 'play' | 'pause' | 'next' | 'previous'

export interface DesktopCapabilityDeps {
  openApp(name: string, path: string | null): Promise<void>
  openExternal(url: string): Promise<void>
  findByName(query: string, limit: number): Promise<string[]>
  /** Files the user opened in the last `sinceHours`, newest first. */
  recentFiles(sinceHours: number, limit: number): Promise<RecentFile[]>
  /** Drives the music player; resolves to "Artist — Track" when something plays, '' otherwise. */
  music(action: MusicAction, query: string | null): Promise<string>
  /** The newest screen capture on this Mac, or null when there has never been one. */
  latestScreenshot(): Promise<Screenshot | null>
  now(): Date
}

export type OpenAppPayload = { name: string; path: string | null }
export type OpenUrlPayload = { url: string }
export type MusicPayload = { action: MusicAction; query: string | null }

const MUSIC_INVERSE: Record<MusicAction, MusicAction> = {
  play: 'pause',
  pause: 'play',
  next: 'previous',
  previous: 'next'
}
/** Playback can always be put back the other way. */
const REVERSIBLE_MUTATION: Effect = { reversible: true, world: 'mutates', discloses: 'nothing' }
const RECENT_DEFAULT_HOURS = 24
const RECENT_DEFAULT_LIMIT = 20
const HOUR_MS = 60 * 60 * 1000

export const FIND_FILE_LIMIT = 50

const READ_ONLY: Effect = { reversible: false, world: 'reads', discloses: 'query' }
/** Opening things adds a window; closing it again is the user's, not ours. */
const ONE_WAY_CREATE: Effect = { reversible: false, world: 'creates', discloses: 'nothing' }

const optionalPath = z
  .string()
  .min(1)
  .transform((value, ctx) => {
    try {
      return resolveFolder(value)
    } catch (err) {
      ctx.addIssue({ code: 'custom', message: (err as Error).message })
      return z.NEVER
    }
  })
  .nullable()
  .default(null)
  .describe('Optional file or folder to open with the app — a full path or ~/... ')

export function desktopCapabilities(deps: DesktopCapabilityDeps): Capability[] {
  const openApp: Capability<{ name: string; path: string | null }> = {
    name: 'open_app',
    description: 'Open an application, optionally with a file or folder',
    examples: ['open Notes', 'open talyx in vscode', 'launch Spotify'],
    params: z.object({
      name: z.string().min(1).describe('Application name as it appears in the Applications folder'),
      path: optionalPath
    }),
    effect: ONE_WAY_CREATE,
    async plan({ name, path }): Promise<Proposal> {
      return {
        kind: 'plan',
        summary: path ? `Open ${name} with ${path}` : `Open ${name}`,
        operations: [
          {
            label: path ? `open ${name} with ${path}` : `open ${name}`,
            reason: 'launch',
            payload: { name, path } satisfies OpenAppPayload,
            inverse: null
          }
        ]
      }
    },
    async execute(op) {
      const { name, path } = op.payload as OpenAppPayload
      await deps.openApp(name, path)
    }
  }

  const openUrl: Capability<{ url: string }> = {
    name: 'open_url',
    description: 'Open a web address in the default browser',
    examples: ['open github', 'open https://news.ycombinator.com'],
    params: z.object({
      url: z.url({ protocol: /^https?$/ }).describe('Full http or https address')
    }),
    effect: ONE_WAY_CREATE,
    async plan({ url }): Promise<Proposal> {
      return {
        kind: 'plan',
        summary: `Open ${url}`,
        operations: [
          {
            label: `open ${url}`,
            reason: 'browse',
            payload: { url } satisfies OpenUrlPayload,
            inverse: null
          }
        ]
      }
    },
    async execute(op) {
      await deps.openExternal((op.payload as OpenUrlPayload).url)
    }
  }

  const findFile: Capability<{ query: string }> = {
    name: 'find_file',
    description: 'Find files anywhere on this computer by (part of) their name',
    examples: ['find the file called budget', 'where is talyx.dmg'],
    params: z.object({ query: z.string().min(1).describe('Part of the file name') }),
    effect: READ_ONLY,
    async plan({ query }): Promise<Proposal> {
      const paths = (await deps.findByName(query, FIND_FILE_LIMIT)).slice(0, FIND_FILE_LIMIT)
      const summary =
        paths.length === 0
          ? `No files named like "${query}"`
          : paths.length === FIND_FILE_LIMIT
            ? `First ${FIND_FILE_LIMIT} files named like "${query}"`
            : `${paths.length} file${paths.length === 1 ? '' : 's'} named like "${query}"`
      return {
        kind: 'answer',
        summary,
        evidence: paths.map((p) => ({ source: p, text: fileName(p) })),
        card: {
          kind: 'paths',
          entries: paths.map((p) => ({
            path: p,
            label: fileName(p),
            snippet: null,
            isDirectory: false
          }))
        }
      }
    }
  }

  const openRecent: Capability<{ hours: number; limit: number }> = {
    name: 'open_recent',
    description: 'Show the files the user worked on recently, so one can be opened',
    examples: ['what was I working on yesterday', 'open the file I had open this morning'],
    params: z.object({
      hours: z
        .number()
        .int()
        .min(1)
        .max(168)
        .default(RECENT_DEFAULT_HOURS)
        .describe('How far back to look'),
      limit: z.number().int().min(1).max(50).default(RECENT_DEFAULT_LIMIT)
    }),
    effect: READ_ONLY,
    async plan({ hours, limit }): Promise<Proposal> {
      const files = await deps.recentFiles(hours, limit)
      const now = deps.now()
      const window = hours > 24 && hours % 24 === 0 ? `${hours / 24} days` : `${hours} hours`
      return {
        kind: 'answer',
        summary:
          files.length === 0
            ? `No files used in the last ${window}`
            : `${files.length} file${files.length === 1 ? '' : 's'} used in the last ${window}`,
        evidence: files.map((f) => ({
          source: f.path,
          text: `${f.name} · ${ago(f.lastUsedAt, now)}`
        })),
        card: {
          kind: 'paths',
          entries: files.map((f) => ({
            path: f.path,
            label: f.name,
            snippet: ago(f.lastUsedAt, now),
            isDirectory: false
          }))
        }
      }
    }
  }

  const musicControl: Capability<MusicPayload> = {
    name: 'music_control',
    description: 'Play, pause or skip music, optionally playing something by name',
    examples: ['play some daft punk', 'pause the music', 'next song'],
    params: z.object({
      action: z.enum(['play', 'pause', 'next', 'previous']),
      query: z.string().min(1).nullable().default(null).describe('Artist, album or song to play')
    }),
    effect: REVERSIBLE_MUTATION,
    async plan({ action, query }): Promise<Proposal> {
      const label =
        action === 'play'
          ? query
            ? `Play "${query}"`
            : 'Play the music'
          : action === 'pause'
            ? 'Pause the music'
            : action === 'next'
              ? 'Next track'
              : 'Previous track'
      return {
        kind: 'plan',
        summary: label,
        operations: [
          {
            label,
            reason: 'music',
            payload: { action, query },
            inverse: { action: MUSIC_INVERSE[action], query: null }
          }
        ]
      }
    },
    async execute(op) {
      const { action, query } = op.payload as MusicPayload
      const playing = await deps.music(action, query)
      return playing ? `Now playing: ${playing}` : 'Done'
    },
    async revert(op) {
      const { action } = op.inverse as MusicPayload
      await deps.music(action, null)
    }
  }

  const lastScreenshot: Capability<Record<string, never>> = {
    name: 'last_screenshot',
    description: 'Find the screenshot taken most recently, so it can be opened, converted or read',
    examples: [
      'where is the screenshot I just took',
      'open my last screenshot',
      'what did I screenshot'
    ],
    params: z.object({}),
    effect: READ_ONLY,
    async plan(): Promise<Proposal> {
      const shot = await deps.latestScreenshot()
      if (!shot) return { kind: 'answer', summary: 'No screenshots on this Mac', evidence: [] }
      const when = ago(shot.takenAt, deps.now())
      return {
        kind: 'answer',
        summary: `Your last screenshot — ${when}`,
        evidence: [{ source: shot.path, text: shot.name }],
        card: {
          kind: 'paths',
          entries: [{ path: shot.path, label: shot.name, snippet: when, isDirectory: false }]
        }
      }
    }
  }

  return [
    openApp as Capability,
    openUrl as Capability,
    findFile as Capability,
    openRecent as Capability,
    lastScreenshot as Capability,
    musicControl as Capability
  ]
}

function ago(iso: string, now: Date): string {
  const hours = Math.floor((now.getTime() - Date.parse(iso)) / HOUR_MS)
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}
