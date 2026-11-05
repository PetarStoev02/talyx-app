import { describe, expect, it, vi } from 'vitest'

const logger = vi.hoisted(() => ({ warn: vi.fn(), info: vi.fn() }))
vi.mock('electron-log', () => ({ default: logger }))

import {
  createUpdateStore,
  next,
  type UpdateEvent
} from '../../../src/main/infrastructure/updater/updateState'
import { ReleaseDownloadError } from '../../../src/main/infrastructure/updater/releaseDownload'
import type { FoundRelease } from '../../../src/main/infrastructure/updater/releaseCheck'
import type { ReleaseSummary, UpdateState } from '../../../src/shared/updater'

function summary(version: string, downloadable = true): ReleaseSummary {
  return {
    version,
    url: `https://github.com/PetarStoev02/talyx-app/releases/tag/v${version}`,
    publishedAt: '',
    highlights: [],
    changes: 0,
    downloadable
  }
}

function found(version: string, downloadable = true): FoundRelease {
  const download = 'https://github.com/PetarStoev02/talyx-app/releases/download/'
  return {
    summary: summary(version, downloadable),
    asset: { name: 'Talyx-arm64.dmg', url: `${download}Talyx-arm64.dmg`, size: 10 },
    checksums: { name: 'SHA256SUMS', url: `${download}SHA256SUMS`, size: 1 }
  }
}

const v1 = summary('1.0.0')
const v2 = summary('1.1.0')
const NONE: UpdateState = { kind: 'none' }
const available: UpdateState = { kind: 'available', release: v1 }
const downloading: UpdateState = { kind: 'downloading', release: v1, received: 4, total: 10 }
const ready: UpdateState = { kind: 'ready', release: v1 }
const failed: UpdateState = { kind: 'failed', release: v1, reason: 'network' }
const unavailable: UpdateState = { kind: 'available', release: summary('1.0.0', false) }

describe('next', () => {
  it.each<[string, UpdateState, UpdateEvent, UpdateState]>([
    ['none finds a release', NONE, { kind: 'found', release: v1 }, available],
    ['none finds nothing', NONE, { kind: 'found', release: null }, NONE],
    ['available finds the same version', available, { kind: 'found', release: v1 }, available],
    [
      'available finds a newer one',
      available,
      { kind: 'found', release: v2 },
      { kind: 'available', release: v2 }
    ],
    ['available is up to date again', available, { kind: 'found', release: null }, NONE],
    ['downloading finds a newer one', downloading, { kind: 'found', release: v2 }, downloading],
    ['downloading finds nothing', downloading, { kind: 'found', release: null }, downloading],
    ['ready finds the same version', ready, { kind: 'found', release: v1 }, ready],
    [
      'ready finds a newer one',
      ready,
      { kind: 'found', release: v2 },
      { kind: 'available', release: v2 }
    ],
    ['failed finds the same version', failed, { kind: 'found', release: v1 }, failed],
    [
      'failed finds a newer one',
      failed,
      { kind: 'found', release: v2 },
      { kind: 'available', release: v2 }
    ],
    [
      'available starts',
      available,
      { kind: 'download', total: 10 },
      { kind: 'downloading', release: v1, received: 0, total: 10 }
    ],
    [
      'failed tries again',
      failed,
      { kind: 'download', total: 10 },
      { kind: 'downloading', release: v1, received: 0, total: 10 }
    ],
    ['an undownloadable release starts', unavailable, { kind: 'download', total: 10 }, unavailable],
    ['downloading starts again', downloading, { kind: 'download', total: 10 }, downloading],
    ['ready starts', ready, { kind: 'download', total: 10 }, ready],
    ['none starts', NONE, { kind: 'download', total: 10 }, NONE],
    [
      'downloading progresses',
      downloading,
      { kind: 'progress', received: 8, total: 10 },
      { ...downloading, received: 8 }
    ],
    ['available progresses', available, { kind: 'progress', received: 8, total: 10 }, available],
    ['downloading verifies', downloading, { kind: 'verified' }, ready],
    [
      'downloading fails',
      downloading,
      { kind: 'failed', reason: 'checksum' },
      { kind: 'failed', release: v1, reason: 'checksum' }
    ],
    ['downloading is cancelled', downloading, { kind: 'cancelled' }, available],
    ['ready is cancelled', ready, { kind: 'cancelled' }, ready]
  ])('should move from %s', (_name, state, event, expected) => {
    expect(next(state, event)).toEqual(expected)
  })

  it('should return the same state when an event changes nothing', () => {
    expect(next(available, { kind: 'found', release: summary('1.0.0') })).toBe(available)
    expect(next(ready, { kind: 'verified' })).toBe(ready)
  })
})

describe('update store', () => {
  function store(download = vi.fn(async () => '/downloads/Talyx-arm64.dmg')): {
    updates: ReturnType<typeof createUpdateStore>
    published: UpdateState[]
    download: typeof download
    open: ReturnType<typeof vi.fn>
  } {
    const published: UpdateState[] = []
    const open = vi.fn(async () => undefined)
    const updates = createUpdateStore({ download, open, publish: (s) => published.push(s) })
    return { updates, published, download, open }
  }

  it('should download the release it was handed and open the verified file', async () => {
    const { updates, published, download, open } = store()
    updates.found(found('1.0.0'))
    await updates.startDownload()

    expect(download).toHaveBeenCalledWith(
      found('1.0.0'),
      expect.any(Function),
      expect.any(AbortSignal)
    )
    expect(published.map((s) => s.kind)).toEqual(['available', 'downloading', 'ready'])
    await updates.openInstaller()
    expect(open).toHaveBeenCalledWith('/downloads/Talyx-arm64.dmg')
  })

  it('should refuse to open anything before a download is verified', async () => {
    const { updates, open } = store()
    await expect(updates.openInstaller()).rejects.toThrow('No verified download')
    updates.found(found('1.0.0'))
    await expect(updates.openInstaller()).rejects.toThrow('No verified download')
    expect(open).not.toHaveBeenCalled()
  })

  it('should fail with the download reason and log only the asset name and reason', async () => {
    const { updates } = store(
      vi.fn(async () => {
        throw new ReleaseDownloadError('checksum', 'mismatch')
      })
    )
    updates.found(found('1.0.0'))
    await updates.startDownload()

    expect(updates.current()).toEqual({ kind: 'failed', release: v1, reason: 'checksum' })
    expect(logger.warn).toHaveBeenCalledWith('[Updater] Talyx-arm64.dmg failed (checksum)')
  })

  it('should return to available when the download is cancelled', async () => {
    const download = vi.fn(
      (_found: FoundRelease, _progress: unknown, signal: AbortSignal) =>
        new Promise<string>((_resolve, reject) =>
          signal.addEventListener('abort', () => reject(new ReleaseDownloadError('network', 'x')))
        )
    )
    const { updates } = store(download as never)
    updates.found(found('1.0.0'))
    const running = updates.startDownload()
    expect(updates.current().kind).toBe('downloading')

    updates.cancel()
    await running
    expect(updates.current()).toEqual(available)
  })

  it('should run one download at a time', async () => {
    const { updates, download } = store()
    updates.found(found('1.0.0'))
    await Promise.all([updates.startDownload(), updates.startDownload()])
    expect(download).toHaveBeenCalledTimes(1)
  })

  it('should not publish when a check finds the same release again', () => {
    const { updates, published } = store()
    updates.found(found('1.0.0'))
    updates.found(found('1.0.0'))
    expect(published).toHaveLength(1)
  })
})
