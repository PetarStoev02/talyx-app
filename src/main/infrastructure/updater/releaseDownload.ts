import { createHash } from 'crypto'
import type * as fsPromises from 'fs/promises'
import { basename, join } from 'path'
import type { UpdateFailure } from '../../../shared/updater'
import type { FoundRelease, ReleaseAsset } from './releaseCheck'

export const MAX_DOWNLOAD_BYTES = 500 * 1024 * 1024
const PROGRESS_INTERVAL_MS = 100
// A half-written file never sits under the installer's own name.
const PARTIAL_SUFFIX = '.part'

export class ReleaseDownloadError extends Error {
  constructor(
    readonly reason: UpdateFailure,
    message: string
  ) {
    super(message)
    this.name = 'ReleaseDownloadError'
  }
}

export interface DownloadDeps {
  fetch: typeof fetch
  /** The folder the installer is saved in (the OS downloads folder). */
  dir: string
  fs: Pick<typeof fsPromises, 'open' | 'rename' | 'rm'>
  /** The largest installer accepted; defaults to MAX_DOWNLOAD_BYTES. */
  maxBytes?: number
}

/**
 * Downloads this computer's installer from the release main fetched, checks it against the
 * release's SHA256SUMS and returns its path. Anything short of a match leaves no file behind.
 */
export async function downloadRelease(
  found: FoundRelease,
  deps: DownloadDeps,
  onProgress: (received: number, total: number) => void,
  signal: AbortSignal
): Promise<string> {
  const { asset, checksums } = found
  if (!asset || !checksums || basename(asset.name) !== asset.name)
    throw new ReleaseDownloadError('other', 'This release has no installer for this computer')
  const maxBytes = deps.maxBytes ?? MAX_DOWNLOAD_BYTES
  if (asset.size > maxBytes) throw tooLarge()

  const expected = expectedHash(await fetchText(deps.fetch, checksums.url, signal), asset.name)
  if (!expected)
    throw new ReleaseDownloadError('checksum', 'SHA256SUMS does not list this installer')

  const partial = join(deps.dir, asset.name + PARTIAL_SUFFIX)
  try {
    const actual = await save(asset, partial, deps, onProgress, signal)
    if (actual !== expected)
      throw new ReleaseDownloadError(
        'checksum',
        "The download did not match the release's checksum"
      )
    const target = join(deps.dir, asset.name)
    await deps.fs.rename(partial, target)
    return target
  } catch (error) {
    await deps.fs.rm(partial, { force: true })
    throw error instanceof ReleaseDownloadError
      ? error
      : new ReleaseDownloadError('other', 'The installer could not be saved')
  }
}

/** Streams the asset to `path`, hashing as it goes; returns the SHA-256 in hex. */
async function save(
  asset: ReleaseAsset,
  path: string,
  deps: DownloadDeps,
  onProgress: (received: number, total: number) => void,
  signal: AbortSignal
): Promise<string> {
  const response = await network(() => deps.fetch(asset.url, { signal }))
  if (!response.ok || !response.body)
    throw new ReleaseDownloadError('network', `The download answered ${response.status}`)
  const maxBytes = deps.maxBytes ?? MAX_DOWNLOAD_BYTES
  if (Number(response.headers.get('content-length')) > maxBytes) {
    await response.body.cancel()
    throw tooLarge()
  }

  const reader = response.body.getReader()
  const hash = createHash('sha256')
  const file = await deps.fs.open(path, 'w')
  let received = 0
  let reported = Number.NEGATIVE_INFINITY
  try {
    for (;;) {
      const { done, value } = await network(() => reader.read())
      if (done) break
      received += value.byteLength
      if (received > maxBytes) throw tooLarge()
      hash.update(value)
      await file.write(value)
      if (Date.now() - reported >= PROGRESS_INTERVAL_MS) {
        reported = Date.now()
        onProgress(received, asset.size)
      }
    }
  } catch (error) {
    // Close the connection; the reader may already be errored, which is fine.
    await reader.cancel().catch(() => undefined)
    throw error
  } finally {
    await file.close()
  }
  onProgress(received, asset.size)
  return hash.digest('hex')
}

async function fetchText(fetchFn: typeof fetch, url: string, signal: AbortSignal): Promise<string> {
  const response = await network(() => fetchFn(url, { signal }))
  if (!response.ok)
    throw new ReleaseDownloadError('network', `SHA256SUMS answered ${response.status}`)
  return network(() => response.text())
}

/** The hash `sha256sum` wrote for `name` (`<hex>  <name>`, or `<hex> *<name>`), or null. */
function expectedHash(sums: string, name: string): string | null {
  for (const line of sums.split(/\r?\n/)) {
    const match = /^([0-9a-fA-F]{64}) [ *](.+?)\s*$/.exec(line)
    if (match?.[2] === name) return match[1].toLowerCase()
  }
  return null
}

/** Runs a fetch or stream read; its failure (or a cancel) is a network failure. */
async function network<T>(step: () => Promise<T>): Promise<T> {
  try {
    return await step()
  } catch {
    throw new ReleaseDownloadError('network', 'The download was interrupted')
  }
}

function tooLarge(): ReleaseDownloadError {
  return new ReleaseDownloadError('too-large', 'The installer is larger than Talyx accepts')
}
