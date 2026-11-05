import { describe, expect, it } from 'vitest'
import { EXPECTED_ENGINE_VERSION, type EngineStatus } from '../../../src/shared/engine'
import type { ReleaseSummary, UpdateState } from '../../../src/shared/updater'
import { releaseAge, updateItems } from '@features/updates/items'

function attached(version: string): EngineStatus {
  return {
    state: 'attached',
    version,
    commit: null,
    home: '/home',
    path: '/bin/talyx-engine',
    stale: false,
    botMetaKey: 'meta',
    botGroupsMetaKey: 'groups',
    managerHandle: '@talyx'
  }
}

const release: ReleaseSummary = {
  version: '1.0.1',
  url: 'https://example.test/release',
  publishedAt: '2026-11-05T09:00:00Z',
  highlights: [],
  changes: 3,
  downloadable: true
}
const none: UpdateState = { kind: 'none' }
const available: UpdateState = { kind: 'available', release }
const older = attached('0.0.1')

describe('updateItems', () => {
  it('should offer nothing when the engine is current and no release is out', () => {
    expect(updateItems(attached(EXPECTED_ENGINE_VERSION), none)).toEqual([])
  })

  it('should offer the pinned engine when the attached engine is older', () => {
    expect(updateItems(older, none)).toEqual([
      { kind: 'engine', installed: '0.0.1', pinned: EXPECTED_ENGINE_VERSION }
    ])
  })

  it('should offer the Talyx release in whatever state it is in', () => {
    expect(updateItems(attached(EXPECTED_ENGINE_VERSION), available)).toEqual([
      { kind: 'talyx', state: available }
    ])
  })

  it('should list the engine first when both updates are pending', () => {
    expect(updateItems(older, available).map((item) => item.kind)).toEqual(['engine', 'talyx'])
  })

  it('should not offer an engine update without an attached engine', () => {
    const missing: EngineStatus = { state: 'missing', enginePath: null }
    expect(updateItems(missing, none)).toEqual([])
    expect(updateItems(null, available)).toEqual([{ kind: 'talyx', state: available }])
  })
})

describe('releaseAge', () => {
  const published = Date.parse(release.publishedAt)
  const minute = 60_000

  it.each([
    [30_000, { unit: 'now', count: 0 }],
    [5 * minute, { unit: 'minutes', count: 5 }],
    [3 * 60 * minute + 59 * minute, { unit: 'hours', count: 3 }],
    [2 * 24 * 60 * minute, { unit: 'days', count: 2 }]
  ])('should read %i ms after publishing as %o', (elapsed, age) => {
    expect(releaseAge(release.publishedAt, published + elapsed)).toEqual(age)
  })

  it('should read a clock behind the release as just now', () => {
    expect(releaseAge(release.publishedAt, published - minute)).toEqual({ unit: 'now', count: 0 })
  })

  it('should have no age for an unreadable date', () => {
    expect(releaseAge('', published)).toBeNull()
  })
})
