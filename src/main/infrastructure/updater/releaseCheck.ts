import log from 'electron-log'
import type { Highlight, ReleaseSummary } from '../../../shared/updater'
import { FEED_SIGNATURE_SUFFIX } from './feedSignature'

const LATEST_RELEASE_API = 'https://api.github.com/repos/PetarStoev02/talyx-app/releases/latest'
const RELEASE_PAGE_PREFIX = 'https://github.com/PetarStoev02/talyx-app/releases/'

export const RELEASE_ASSET_PREFIX = 'https://github.com/PetarStoev02/talyx-app/releases/download/'
// Served from GitHub's CDN, without the API's 60 requests an hour per IP address.
const LATEST_FEED_PREFIX = 'https://github.com/PetarStoev02/talyx-app/releases/latest/download/'
// electron-updater's feed for the installs that update themselves.
export const UPDATE_FEED_NAME: Partial<Record<NodeJS.Platform, string>> = {
  darwin: 'latest-mac.yml',
  linux: 'latest-linux.yml'
}
const MAX_HIGHLIGHTS = 3

const REQUEST_TIMEOUT_MS = 10_000

export interface FoundRelease {
  summary: ReleaseSummary
}

export type ReleaseCheck =
  | { kind: 'available'; release: FoundRelease }
  | { kind: 'up-to-date' }
  | { kind: 'failed' }

export interface InstallTarget {
  platform: NodeJS.Platform
  arch: string
  /** On Linux, whether this Talyx runs as an AppImage; a deb install gets the release page. */
  appImage: boolean
}

interface Version {
  core: number[]
  /** Pre-release label such as `alpha.1`; null for a final release. */
  pre: string | null
}

function parse(version: string): Version | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(version.trim())
  return match ? { core: match.slice(1, 4).map(Number), pre: match[4] ?? null } : null
}

export function isNewerVersion(latest: string, current: string): boolean {
  const a = parse(latest)
  const b = parse(current)
  if (!a || !b) return false
  for (let i = 0; i < 3; i++) if (a.core[i] !== b.core[i]) return a.core[i] > b.core[i]
  // Same core: a final release beats any pre-release of it (1.0.0 > 1.0.0-alpha.1)
  if (a.pre === null || b.pre === null) return a.pre === null && b.pre !== null
  // ponytail: numeric-aware string compare, not full semver identifier rules; fine for alpha.N / beta.N
  return a.pre.localeCompare(b.pre, 'en', { numeric: true }) > 0
}

/** Lines of one `## <title>` section, up to the next `## ` heading. */
function sectionLines(body: string, title: RegExp): string[] {
  const lines = body.split(/\r?\n/)
  const start = lines.findIndex((line) => title.test(line.trim()))
  if (start === -1) return []
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((line) => /^##\s/.test(line))
  return end === -1 ? rest : rest.slice(0, end)
}

/** Reads `- **Lead.** Text.` bullets under `## Highlights`; anything else is ignored. */
export function parseHighlights(body: string): Highlight[] {
  const found: Highlight[] = []
  for (const line of sectionLines(body, /^##\s+Highlights$/i)) {
    const match = /^[-*]\s+\*\*(.+?)\*\*\s+(\S.*)$/.exec(line.trim())
    if (match) found.push({ lead: match[1], text: match[2] })
  }
  return found.slice(0, MAX_HIGHLIGHTS)
}

/** Counts the bullets GitHub generates under `## What's Changed`. */
export function countChanges(body: string): number {
  return sectionLines(body, /^##\s+What['\u2019]s Changed$/i).filter((line) =>
    /^[-*]\s/.test(line.trim())
  ).length
}

function normalisedHref(url: string): string | null {
  try {
    return new URL(url).href
  } catch {
    return null
  }
}

/** The names of the release's files that are served from the Talyx repository. */
function assetNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const names: string[] = []
  for (const item of raw as Array<Record<string, unknown> | null>) {
    const name = item?.name
    const url = item?.browser_download_url
    if (typeof name !== 'string' || typeof url !== 'string') continue
    // Compare the normalised URL, so a `../` segment cannot climb out of the repository.
    if (normalisedHref(url)?.startsWith(RELEASE_ASSET_PREFIX)) names.push(name)
  }
  return names
}

/**
 * The latest release's version from its update feed, or null when the feed cannot be read (a
 * release without one, no connection): the API then answers instead.
 */
async function feedVersion(
  fetchFn: typeof fetch,
  platform: NodeJS.Platform,
  currentVersion: string
): Promise<string | null> {
  // A deb install reads latest-linux.yml too: only the version matters here.
  const feed = UPDATE_FEED_NAME[platform]
  if (!feed) return null
  try {
    const response = await fetchFn(`${LATEST_FEED_PREFIX}${feed}`, {
      headers: { 'User-Agent': `Talyx/${currentVersion}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
    if (!response.ok) return null
    const match = /^version:\s*['"]?([^\s'"]+)/m.exec(await response.text())
    return match && parse(match[1]) ? match[1] : null
  } catch (err) {
    log.warn('Update check: feed unreadable:', err instanceof Error ? err.message : String(err))
    return null
  }
}

/**
 * Asks GitHub for the latest published release newer than this Talyx: the update feed first, then
 * the API only for a newer release, for its notes. Drafts and pre-releases are invisible to both.
 */
export async function fetchLatestRelease(
  fetchFn: typeof fetch,
  currentVersion: string,
  target: InstallTarget = {
    platform: process.platform,
    arch: process.arch,
    appImage: Boolean(process.env['APPIMAGE'])
  }
): Promise<ReleaseCheck> {
  const latest = await feedVersion(fetchFn, target.platform, currentVersion)
  if (latest && !isNewerVersion(latest, currentVersion)) return { kind: 'up-to-date' }
  try {
    const response = await fetchFn(LATEST_RELEASE_API, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': `Talyx/${currentVersion}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
    if (!response.ok) {
      log.warn(`Update check: GitHub answered ${response.status}`)
      return { kind: 'failed' }
    }
    const body = (await response.json()) as Record<string, unknown>
    if (typeof body.tag_name !== 'string' || typeof body.html_url !== 'string') {
      log.warn('Update check: unexpected release payload')
      return { kind: 'failed' }
    }
    if (!body.html_url.startsWith(RELEASE_PAGE_PREFIX)) {
      log.warn('Update check: release page is outside the Talyx repository')
      return { kind: 'failed' }
    }
    if (!parse(body.tag_name)) {
      log.warn('Update check: release tag is not a version number')
      return { kind: 'failed' }
    }
    if (!isNewerVersion(body.tag_name, currentVersion)) return { kind: 'up-to-date' }
    // Talyx downloads a release only through its signed update feed: an AppImage or a Mac
    // install whose release has the feed and its signature. Anything else gets the release page.
    const names = assetNames(body.assets)
    const feed = UPDATE_FEED_NAME[target.platform]
    const selfUpdating = target.platform === 'darwin' || target.appImage
    const downloadable =
      selfUpdating &&
      feed !== undefined &&
      names.includes(feed) &&
      names.includes(`${feed}${FEED_SIGNATURE_SUFFIX}`)
    const notes = typeof body.body === 'string' ? body.body : ''
    return {
      kind: 'available',
      release: {
        summary: {
          version: body.tag_name.replace(/^v/, ''),
          url: body.html_url,
          publishedAt: typeof body.published_at === 'string' ? body.published_at : '',
          highlights: parseHighlights(notes),
          changes: countChanges(notes),
          downloadable
        }
      }
    }
  } catch (err) {
    log.warn('Update check failed:', err instanceof Error ? err.message : String(err))
    return { kind: 'failed' }
  }
}
