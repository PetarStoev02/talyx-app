import { createHash } from 'crypto'
import * as fs from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron-log', () => ({ default: { warn: vi.fn(), info: vi.fn() } }))

import {
  MAX_DOWNLOAD_BYTES,
  ReleaseDownloadError,
  downloadRelease
} from '../../../src/main/infrastructure/updater/releaseDownload'
import type { FoundRelease } from '../../../src/main/infrastructure/updater/releaseCheck'

const ASSET_URL = 'https://github.com/PetarStoev02/talyx-app/releases/download/v1.0.0/Talyx.dmg'
const SUMS_URL = 'https://github.com/PetarStoev02/talyx-app/releases/download/v1.0.0/SHA256SUMS'
const CHUNKS = ['first ', 'second ', 'third'].map((text) => new TextEncoder().encode(text))
const CONTENT = Buffer.concat(CHUNKS)
const sha256 = (data: Uint8Array): string => createHash('sha256').update(data).digest('hex')

function release(size = CONTENT.length): FoundRelease {
  return {
    summary: {
      version: '1.0.0',
      url: 'https://github.com/PetarStoev02/talyx-app/releases/tag/v1.0.0',
      publishedAt: '',
      highlights: [],
      changes: 0,
      downloadable: true
    },
    asset: { name: 'Talyx.dmg', url: ASSET_URL, size },
    checksums: { name: 'SHA256SUMS', url: SUMS_URL, size: 100 }
  }
}

/** A body that hands out its chunks, then waits for the abort if `hang` is set. */
function body(chunks: Uint8Array[], signal: AbortSignal | undefined, hang = false): ReadableStream {
  let index = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) return controller.enqueue(chunks[index++])
      if (!hang) return controller.close()
      return new Promise<void>((resolve) => {
        const fail = (): void => {
          controller.error(new DOMException('aborted', 'AbortError'))
          resolve()
        }
        if (signal?.aborted) fail()
        else signal?.addEventListener('abort', fail)
      })
    }
  })
}

interface FakeServer {
  sums?: string
  chunks?: Uint8Array[]
  status?: number
  length?: number
  hang?: boolean
}

function server(options: FakeServer = {}): typeof fetch {
  const sums = options.sums ?? `${sha256(CONTENT)}  Talyx.dmg\nabc  other.exe\n`
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url === SUMS_URL) return new Response(sums)
    if (url !== ASSET_URL) throw new TypeError('fetch failed')
    const headers = options.length === undefined ? {} : { 'content-length': `${options.length}` }
    return new Response(body(options.chunks ?? CHUNKS, init?.signal ?? undefined, options.hang), {
      status: options.status ?? 200,
      headers
    })
  }) as unknown as typeof fetch
}

describe('downloadRelease', () => {
  let dir: string

  beforeEach(async () => {
    dir = await fs.mkdtemp(join(tmpdir(), 'talyx-download-'))
  })

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  const deps = (fetchFn: typeof fetch): Parameters<typeof downloadRelease>[1] => ({
    fetch: fetchFn,
    dir,
    fs
  })

  async function failure(promise: Promise<unknown>): Promise<string> {
    const error = await promise.then(
      () => null,
      (e: unknown) => e
    )
    expect(error).toBeInstanceOf(ReleaseDownloadError)
    return (error as ReleaseDownloadError).reason
  }

  it('should save the verified installer under its release name and report progress', async () => {
    const progress = vi.fn()
    const path = await downloadRelease(
      release(),
      deps(server()),
      progress,
      new AbortController().signal
    )

    expect(path).toBe(join(dir, 'Talyx.dmg'))
    expect(await fs.readFile(path)).toEqual(CONTENT)
    expect(await fs.readdir(dir)).toEqual(['Talyx.dmg'])
    expect(progress).toHaveBeenLastCalledWith(CONTENT.length, CONTENT.length)
  })

  it('should report progress at most every 100 ms', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
    const progress = vi.fn()
    const many = Array.from({ length: 50 }, () => new Uint8Array([1]))
    const sums = `${sha256(Buffer.concat(many))}  Talyx.dmg`
    await downloadRelease(
      release(50),
      deps(server({ chunks: many, sums })),
      progress,
      new AbortController().signal
    )
    vi.restoreAllMocks()

    // The first chunk and the final total; the 48 between land inside the same 100 ms.
    expect(progress.mock.calls).toEqual([
      [1, 50],
      [50, 50]
    ])
  })

  it('should delete the file when its hash differs from SHA256SUMS', async () => {
    const sums = `${'0'.repeat(64)}  Talyx.dmg`
    const reason = await failure(
      downloadRelease(release(), deps(server({ sums })), vi.fn(), new AbortController().signal)
    )
    expect(reason).toBe('checksum')
    expect(await fs.readdir(dir)).toEqual([])
  })

  it('should not keep a file SHA256SUMS does not list', async () => {
    const sums = `${sha256(CONTENT)}  Talyx-other.dmg`
    const reason = await failure(
      downloadRelease(release(), deps(server({ sums })), vi.fn(), new AbortController().signal)
    )
    expect(reason).toBe('checksum')
    expect(await fs.readdir(dir)).toEqual([])
  })

  it('should refuse a release asset over the size cap before downloading', async () => {
    const fetchFn = server()
    const reason = await failure(
      downloadRelease(
        release(MAX_DOWNLOAD_BYTES + 1),
        deps(fetchFn),
        vi.fn(),
        new AbortController().signal
      )
    )
    expect(reason).toBe('too-large')
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('should stop a download whose content length is over the size cap', async () => {
    const reason = await failure(
      downloadRelease(
        release(),
        deps(server({ length: MAX_DOWNLOAD_BYTES + 1 })),
        vi.fn(),
        new AbortController().signal
      )
    )
    expect(reason).toBe('too-large')
    expect(await fs.readdir(dir)).toEqual([])
  })

  it('should fail with a network reason when the server answers an error', async () => {
    const reason = await failure(
      downloadRelease(
        release(),
        deps(server({ status: 404 })),
        vi.fn(),
        new AbortController().signal
      )
    )
    expect(reason).toBe('network')
    expect(await fs.readdir(dir)).toEqual([])
  })

  it('should fail without touching the disk when the release has no installer here', async () => {
    const reason = await failure(
      downloadRelease(
        { ...release(), asset: null },
        deps(server()),
        vi.fn(),
        new AbortController().signal
      )
    )
    expect(reason).toBe('other')
    expect(await fs.readdir(dir)).toEqual([])
  })

  it('should remove the partial file when the download is cancelled', async () => {
    const controller = new AbortController()
    const progress = vi.fn(() => controller.abort())
    const reason = await failure(
      downloadRelease(release(), deps(server({ hang: true })), progress, controller.signal)
    )
    expect(progress).toHaveBeenCalled()
    expect(reason).toBe('network')
    expect(await fs.readdir(dir)).toEqual([])
  })
})
