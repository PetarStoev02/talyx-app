import { describe, expect, it, vi } from 'vitest'
import { createReleaseChecks } from '../../../src/main/infrastructure/updater/releaseChecks'
import type {
  FoundRelease,
  ReleaseCheck
} from '../../../src/main/infrastructure/updater/releaseCheck'

const RELEASE: FoundRelease = {
  summary: {
    version: '1.0.3',
    url: 'https://github.com/PetarStoev02/talyx-app/releases/tag/v1.0.3',
    publishedAt: '',
    highlights: [],
    changes: 0,
    automatic: true,
    downloadable: true
  },
  asset: null,
  checksums: null
}
const HOUR = 60 * 60_000

function setup(result: ReleaseCheck = { kind: 'available', release: RELEASE }): {
  checks: ReturnType<typeof createReleaseChecks>
  fetchLatest: ReturnType<typeof vi.fn<() => Promise<ReleaseCheck>>>
  found: ReturnType<typeof vi.fn<(release: FoundRelease | null) => void>>
  clock: { now: number }
} {
  const clock = { now: 0 }
  const fetchLatest = vi.fn(async () => result)
  const found = vi.fn<(release: FoundRelease | null) => void>()
  const checks = createReleaseChecks({ fetchLatest, found, now: () => clock.now })
  return { checks, fetchLatest, found, clock }
}

describe('release checks', () => {
  it.each<[string, ReleaseCheck, unknown, FoundRelease | null | undefined]>([
    [
      'a newer release',
      { kind: 'available', release: RELEASE },
      { kind: 'available', version: '1.0.3' },
      RELEASE
    ],
    ['no newer release', { kind: 'up-to-date' }, { kind: 'up-to-date' }, null],
    ['a failed check', { kind: 'failed' }, { kind: 'failed' }, undefined]
  ])('should report %s and hand it to the update', async (_name, result, reported, handed) => {
    const { checks, found } = setup(result)
    expect(await checks.check()).toEqual(reported)
    if (handed === undefined) expect(found).not.toHaveBeenCalled()
    else expect(found).toHaveBeenCalledWith(handed)
  })

  it('should join a check that is already running, whoever asks', async () => {
    const { checks, fetchLatest, clock } = setup()
    const first = checks.check()
    clock.now = 2 * HOUR
    checks.checkIfOlderThan(HOUR)
    const second = checks.check()
    expect(await first).toEqual(await second)
    expect(fetchLatest).toHaveBeenCalledOnce()

    await checks.check()
    expect(fetchLatest).toHaveBeenCalledTimes(2)
  })

  it('should check on wake or focus only when the last check is older than the limit', async () => {
    const { checks, fetchLatest, clock } = setup()
    checks.checkIfOlderThan(HOUR)
    await vi.waitFor(() => expect(fetchLatest).toHaveBeenCalledOnce())

    clock.now = HOUR
    checks.checkIfOlderThan(HOUR)
    await Promise.resolve()
    expect(fetchLatest).toHaveBeenCalledOnce()

    clock.now = HOUR + 1
    checks.checkIfOlderThan(HOUR)
    await vi.waitFor(() => expect(fetchLatest).toHaveBeenCalledTimes(2))
  })
})
