import fc from 'fast-check'
import { describe, expect, it, vi } from 'vitest'

const logger = vi.hoisted(() => ({ warn: vi.fn(), info: vi.fn() }))
vi.mock('electron-log', () => ({ default: logger }))

import {
  createUpdateStore,
  next,
  type Install,
  ReleaseDownloadError,
  type UpdateEvent,
  type UpdateStoreDeps
} from '../../../src/main/infrastructure/updater/updateState'
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
  return { summary: summary(version, downloadable) }
}

const v1 = summary('1.0.0')
const v2 = summary('1.1.0')
const NONE: UpdateState = { kind: 'none' }
const available: UpdateState = { kind: 'available', release: v1 }
const downloading: UpdateState = { kind: 'downloading', release: v1, received: 4, total: 10 }
const ready: UpdateState = { kind: 'ready', release: v1 }
const failed: UpdateState = { kind: 'failed', release: v1, reason: 'other' }
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
      { kind: 'ready', release: summary('1.0.0') },
      { kind: 'found', release: summary('1.1.0') },
      { kind: 'ready', release: summary('1.0.0') }
    ],
    ['failed finds the same version', failed, { kind: 'found', release: v1 }, failed],
    [
      'available finds the same version with its signed feed added',
      unavailable,
      { kind: 'found', release: v1 },
      available
    ],
    [
      'failed finds the same version changed',
      failed,
      { kind: 'found', release: summary('1.0.0', false) },
      unavailable
    ],
    [
      'downloading finds the same version changed',
      downloading,
      { kind: 'found', release: summary('1.0.0', false) },
      downloading
    ],
    [
      'ready finds the same version changed',
      ready,
      { kind: 'found', release: summary('1.0.0', false) },
      ready
    ],
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
    ['ready is cancelled', ready, { kind: 'cancelled' }, ready],
    [
      'ready fails to open',
      ready,
      { kind: 'failed', reason: 'other' },
      { kind: 'failed', release: v1, reason: 'other' }
    ],
    ['available fails', available, { kind: 'failed', reason: 'other' }, available]
  ])('should move from %s', (_name, state, event, expected) => {
    expect(next(state, event)).toEqual(expected)
  })

  it('should return the same state when an event changes nothing', () => {
    expect(next(available, { kind: 'found', release: summary('1.0.0') })).toBe(available)
    expect(next(ready, { kind: 'verified' })).toBe(ready)
  })
})

describe('update store', () => {
  const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

  function store(): {
    updates: ReturnType<typeof createUpdateStore>
    published: UpdateState[]
    download: ReturnType<typeof vi.fn<UpdateStoreDeps['download']>>
    install: ReturnType<typeof vi.fn<Install>>
  } {
    const published: UpdateState[] = []
    const install = vi.fn<Install>(async () => undefined)
    const download = vi.fn<UpdateStoreDeps['download']>(async () => install)
    const updates = createUpdateStore({ download, publish: (s) => published.push(s) })
    return { updates, published, download, install }
  }

  it('should download the release it was handed only on request, then install it', async () => {
    const { updates, published, download, install } = store()
    updates.found(found('1.0.0'))
    await settle()
    expect(download).not.toHaveBeenCalled()
    await updates.startDownload()

    expect(download).toHaveBeenCalledWith('1.0.0', expect.any(Function), expect.any(AbortSignal))
    expect(install).not.toHaveBeenCalled()
    expect(published.map((s) => s.kind)).toEqual(['available', 'downloading', 'ready'])
    await updates.install()
    expect(install).toHaveBeenCalledOnce()
  })

  it('should keep offering the restart into a downloaded self-update when a newer release appears', async () => {
    const { updates, download, install } = store()
    updates.found(found('1.0.0'))
    await updates.startDownload()
    updates.found(found('1.1.0'))
    await settle()

    expect(download).toHaveBeenCalledOnce()
    expect(updates.current()).toEqual({ kind: 'ready', release: summary('1.0.0') })
    await updates.install()
    expect(install).toHaveBeenCalledOnce()
  })

  it('should refuse to install anything before a download is verified', async () => {
    const { updates, install } = store()
    await expect(updates.install()).rejects.toThrow('No verified download')
    updates.found(found('1.0.0'))
    await expect(updates.install()).rejects.toThrow('No verified download')
    expect(install).not.toHaveBeenCalled()
  })

  it('should move to failed, and offer a retry, when the update cannot be installed', async () => {
    const { updates, published, download, install } = store()
    install.mockRejectedValueOnce(new ReleaseDownloadError('other', 'gone'))
    updates.found(found('1.0.0'))
    await updates.startDownload()

    await expect(updates.install()).rejects.toThrow('gone')
    expect(updates.current()).toEqual({ kind: 'failed', release: v1, reason: 'other' })
    expect(published.at(-1)).toEqual(updates.current())
    await expect(updates.install()).rejects.toBeInstanceOf(ReleaseDownloadError)

    await updates.startDownload()
    expect(download).toHaveBeenCalledTimes(2)
    expect(updates.current().kind).toBe('ready')
  })

  it('should fail with the download reason and log only the version and reason', async () => {
    const { updates, download } = store()
    download.mockRejectedValueOnce(new ReleaseDownloadError('checksum', 'mismatch'))
    updates.found(found('1.0.0'))
    await updates.startDownload()

    expect(updates.current()).toEqual({ kind: 'failed', release: v1, reason: 'checksum' })
    expect(logger.warn).toHaveBeenCalledWith('[Updater] v1.0.0 failed (checksum)')
  })

  it('should return to available when the download is cancelled', async () => {
    const { updates, download } = store()
    download.mockImplementationOnce(
      (_version, _progress, signal) =>
        new Promise<Install>((_resolve, reject) =>
          signal.addEventListener('abort', () => reject(new ReleaseDownloadError('other', 'x')))
        )
    )
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

describe('update store, for any order of checks and clicks', () => {
  // What can happen to the store: a check's answer, the user's clicks, and how a download ends.
  type Step =
    | { kind: 'found'; version: string; downloadable: boolean }
    | { kind: 'up-to-date' }
    | { kind: 'click-download' }
    | { kind: 'click-cancel' }
    | { kind: 'click-restart' }
    | { kind: 'download-ends'; ok: boolean }
    | { kind: 'restart-fails' }

  const step: fc.Arbitrary<Step> = fc.oneof(
    fc.record({
      kind: fc.constant('found' as const),
      version: fc.constantFrom('1.0.0', '1.1.0', '1.2.0'),
      downloadable: fc.boolean()
    }),
    fc.constant({ kind: 'up-to-date' as const }),
    fc.constant({ kind: 'click-download' as const }),
    fc.constant({ kind: 'click-cancel' as const }),
    fc.constant({ kind: 'click-restart' as const }),
    fc.record({ kind: fc.constant('download-ends' as const), ok: fc.boolean() }),
    fc.constant({ kind: 'restart-fails' as const })
  )
  const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

  it('should never download or restart without a click', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(step, { maxLength: 40, size: 'medium' }), async (steps) => {
        const clicks = { download: 0, restart: 0 }
        const ran = { downloads: 0, restarts: 0 }
        let restartFails = false
        // The download running now, ended by a 'download-ends' step.
        const running: Array<{ end: (ok: boolean) => void }> = []
        const updates = createUpdateStore({
          publish: () => undefined,
          download: (_version, _progress, signal) => {
            ran.downloads += 1
            return new Promise<Install>((resolve, reject) => {
              // A download ends once, by its outcome or a cancel, and leaves the running list then.
              const entry = {
                end: (ok: boolean): void => {
                  const at = running.indexOf(entry)
                  if (at < 0) return
                  running.splice(at, 1)
                  if (ok)
                    resolve(async () => {
                      ran.restarts += 1
                      if (restartFails) throw new ReleaseDownloadError('other', 'refused')
                    })
                  else reject(new ReleaseDownloadError('checksum', 'mismatch'))
                }
              }
              running.push(entry)
              signal.addEventListener('abort', () => entry.end(false))
            })
          }
        })
        for (const next of steps) {
          if (next.kind === 'found') updates.found(found(next.version, next.downloadable))
          if (next.kind === 'up-to-date') updates.found(null)
          if (next.kind === 'click-download') {
            clicks.download += 1
            void updates.startDownload()
          }
          if (next.kind === 'click-cancel') updates.cancel()
          if (next.kind === 'click-restart') {
            clicks.restart += 1
            await updates.install().catch(() => undefined)
          }
          if (next.kind === 'download-ends') running.shift()?.end(next.ok)
          if (next.kind === 'restart-fails') restartFails = true
          await settle()

          expect(ran.downloads).toBeLessThanOrEqual(clicks.download)
          expect(ran.restarts).toBeLessThanOrEqual(clicks.restart)
          if (clicks.download === 0) expect(['none', 'available']).toContain(updates.current().kind)
        }
      })
    )
  })
})
