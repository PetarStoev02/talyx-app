import { app, type BrowserWindow } from 'electron'
import log from 'electron-log'

const LATEST_RELEASE_API = 'https://api.github.com/repos/PetarStoev02/talyx-app/releases/latest'
const RELEASE_PAGE_PREFIX = 'https://github.com/PetarStoev02/talyx-app/releases/'

const REQUEST_TIMEOUT_MS = 10_000

export type ReleaseCheck =
  | { kind: 'available'; version: string; url: string }
  | { kind: 'up-to-date' }
  | { kind: 'failed' }

export interface UpdateCheckResult {
  status: 'available' | 'up-to-date' | 'failed'
  version: string | null
  url: string | null
}

function parts(version: string): number[] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version.trim())
  return match ? match.slice(1).map(Number) : null
}

export function isNewerVersion(latest: string, current: string): boolean {
  const a = parts(latest)
  const b = parts(current)
  if (!a || !b) return false
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]
  return false
}

/**
 * Asks GitHub for the latest published release. Talyx is not signed, so it
 * cannot install updates itself; it only tells the user and opens the page.
 * Drafts and pre-releases are invisible to this endpoint.
 */
export async function fetchLatestRelease(
  fetchFn: typeof fetch,
  currentVersion: string
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
    const body = (await response.json()) as { tag_name?: unknown; html_url?: unknown }
    if (typeof body.tag_name !== 'string' || typeof body.html_url !== 'string') {
      log.warn('Update check: unexpected release payload')
      return { kind: 'failed' }
    }
    if (!body.html_url.startsWith(RELEASE_PAGE_PREFIX)) {
      log.warn('Update check: release page is outside the Talyx repository')
      return { kind: 'failed' }
    }
    if (!parts(body.tag_name)) {
      log.warn('Update check: release tag is not a version number')
      return { kind: 'failed' }
    }
    if (!isNewerVersion(body.tag_name, currentVersion)) return { kind: 'up-to-date' }
    return { kind: 'available', version: body.tag_name.replace(/^v/, ''), url: body.html_url }
  } catch (err) {
    log.warn('Update check failed:', err instanceof Error ? err.message : String(err))
    return { kind: 'failed' }
  }
}

export async function checkForUpdate(win: BrowserWindow | null): Promise<UpdateCheckResult> {
  const check = await fetchLatestRelease(fetch, app.getVersion())
  if (check.kind !== 'available') return { status: check.kind, version: null, url: null }
  const { version, url } = check
  if (win && !win.isDestroyed()) win.webContents.send('updater:update-available', { version, url })
  return { status: 'available', version, url }
}
