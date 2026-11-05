import log from 'electron-log'
import type { Highlight, ReleaseSummary } from '../../../shared/updater'

const LATEST_RELEASE_API = 'https://api.github.com/repos/PetarStoev02/talyx-app/releases/latest'
const RELEASE_PAGE_PREFIX = 'https://github.com/PetarStoev02/talyx-app/releases/'

const RELEASE_ASSET_PREFIX = 'https://github.com/PetarStoev02/talyx-app/releases/download/'
const CHECKSUMS_ASSET_NAME = 'SHA256SUMS'
const MAX_HIGHLIGHTS = 3

const REQUEST_TIMEOUT_MS = 10_000

export interface ReleaseAsset {
  name: string
  url: string
  size: number
}

export interface FoundRelease {
  summary: ReleaseSummary
  /** Installer for this computer; null when the release has none. Never leaves main. */
  asset: ReleaseAsset | null
  checksums: ReleaseAsset | null
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

const INSTALLER_EXTENSION: Partial<Record<NodeJS.Platform, string>> = {
  darwin: '.dmg',
  win32: '.exe',
  linux: '.appimage'
}

// The names a release file can use for each `process.arch` (electron-builder writes x86_64 and
// amd64 for x64 on Linux).
const ARCH_NAMES: Record<string, string[]> = {
  x64: ['x64', 'amd64', 'x86_64'],
  arm64: ['arm64', 'aarch64'],
  ia32: ['ia32'],
  arm: ['armv7l']
}
const KNOWN_ARCH_NAMES = Object.values(ARCH_NAMES).flat()

function namesArch(fileName: string, archNames: string[]): boolean {
  const lower = fileName.toLowerCase()
  return archNames.some((arch) => new RegExp(`(^|[^a-z0-9])${arch}([^a-z0-9]|$)`).test(lower))
}

/**
 * The installer for this computer, matched by extension. A file naming this architecture wins; a
 * Mac needs one. Elsewhere a single file naming no architecture will do. Anything else
 * (another architecture only, or two candidates) is ambiguous: null.
 */
export function pickAsset(
  assets: ReleaseAsset[],
  platform: NodeJS.Platform,
  arch: string
): ReleaseAsset | null {
  const extension = INSTALLER_EXTENSION[platform]
  if (!extension) return null
  const matching = assets.filter((asset) => asset.name.toLowerCase().endsWith(extension))
  const forArch = matching.filter((asset) => namesArch(asset.name, ARCH_NAMES[arch] ?? [arch]))
  if (forArch.length > 0 || platform === 'darwin') return only(forArch)
  return only(matching.filter((asset) => !namesArch(asset.name, KNOWN_ARCH_NAMES)))
}

function only(assets: ReleaseAsset[]): ReleaseAsset | null {
  return assets.length === 1 ? assets[0] : null
}

function normalisedHref(url: string): string | null {
  try {
    return new URL(url).href
  } catch {
    return null
  }
}

function readAssets(raw: unknown): ReleaseAsset[] {
  if (!Array.isArray(raw)) return []
  const assets: ReleaseAsset[] = []
  for (const item of raw as Array<Record<string, unknown> | null>) {
    const name = item?.name
    const url = item?.browser_download_url
    const size = item?.size
    if (typeof name !== 'string' || typeof url !== 'string') continue
    if (typeof size !== 'number' || !Number.isFinite(size) || size < 0) continue
    // Compare the normalised URL, so a `../` segment cannot climb out of the repository.
    const href = normalisedHref(url)
    if (href?.startsWith(RELEASE_ASSET_PREFIX)) assets.push({ name, url: href, size })
  }
  return assets
}

/**
 * Asks GitHub for the latest published release newer than this Talyx.
 * Drafts and pre-releases are invisible to this endpoint.
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
    const assets = readAssets(body.assets)
    // The in-app download replaces an AppImage; a deb install updates from the release page.
    const asset =
      target.platform === 'linux' && !target.appImage
        ? null
        : pickAsset(assets, target.platform, target.arch)
    const checksums = assets.find((a) => a.name === CHECKSUMS_ASSET_NAME) ?? null
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
          downloadable: asset !== null && checksums !== null
        },
        asset,
        checksums
      }
    }
  } catch (err) {
    log.warn('Update check failed:', err instanceof Error ? err.message : String(err))
    return { kind: 'failed' }
  }
}
