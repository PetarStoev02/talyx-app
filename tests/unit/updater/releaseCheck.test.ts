import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getVersion: () => '0.11.0' }, BrowserWindow: class {} }))
vi.mock('electron-log', () => ({ default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }))

import {
  fetchLatestRelease,
  isNewerVersion
} from '../../../src/main/infrastructure/updater/releaseCheck'

function respond(body: unknown, ok = true): typeof fetch {
  return vi.fn(async () => ({
    ok,
    status: ok ? 200 : 404,
    json: async () => body
  })) as unknown as typeof fetch
}

describe('isNewerVersion', () => {
  it.each([
    ['0.11.1', '0.11.0', true],
    ['0.12.0', '0.11.9', true],
    ['1.0.0', '0.99.99', true],
    ['v0.11.1', '0.11.0', true],
    ['0.11.0', '0.11.0', false],
    ['0.10.9', '0.11.0', false],
    ['not-a-version', '0.11.0', false]
  ])('should judge %s against %s as newer: %s', (latest, current, expected) => {
    expect(isNewerVersion(latest, current)).toBe(expected)
  })
})

describe('fetchLatestRelease', () => {
  const RELEASE_PAGE = 'https://github.com/PetarStoev02/talyx-app/releases/tag/'

  it('should report the newer release with its GitHub page', async () => {
    const fetchFn = respond({ tag_name: 'v0.11.1', html_url: `${RELEASE_PAGE}v0.11.1` })
    const check = await fetchLatestRelease(fetchFn, '0.11.0')
    expect(check).toEqual({
      kind: 'available',
      version: '0.11.1',
      url: `${RELEASE_PAGE}v0.11.1`
    })
    expect(vi.mocked(fetchFn).mock.calls[0][0]).toBe(
      'https://api.github.com/repos/PetarStoev02/talyx-app/releases/latest'
    )
  })

  it('should give the fetch a timeout signal so a hung request fails', async () => {
    const fetchFn = respond({ tag_name: 'v0.11.1', html_url: `${RELEASE_PAGE}v0.11.1` })
    await fetchLatestRelease(fetchFn, '0.11.0')
    const init = vi.mocked(fetchFn).mock.calls[0][1]
    expect(init?.signal).toBeInstanceOf(AbortSignal)
  })

  it.each(['v1.0', '0.12', 'latest'])(
    'should report a failed check when the release tag %s is not x.y.z',
    async (tag) => {
      const fetchFn = respond({ tag_name: tag, html_url: `${RELEASE_PAGE}${tag}` })
      expect(await fetchLatestRelease(fetchFn, '0.11.0')).toEqual({ kind: 'failed' })
    }
  )

  it('should report up to date when the latest release is not newer', async () => {
    const fetchFn = respond({ tag_name: 'v0.11.0', html_url: `${RELEASE_PAGE}v0.11.0` })
    expect(await fetchLatestRelease(fetchFn, '0.11.0')).toEqual({ kind: 'up-to-date' })
  })

  it('should report a failure when GitHub answers with an error', async () => {
    expect(await fetchLatestRelease(respond({}, false), '0.11.0')).toEqual({ kind: 'failed' })
  })

  it('should report a failure when the network fails', async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error('offline')
    }) as unknown as typeof fetch
    expect(await fetchLatestRelease(fetchFn, '0.11.0')).toEqual({ kind: 'failed' })
  })

  it('should report a failure when the body is malformed', async () => {
    expect(await fetchLatestRelease(respond({ tag_name: 5 }), '0.11.0')).toEqual({
      kind: 'failed'
    })
  })

  it('should never hand back a page outside github.com', async () => {
    const fetchFn = respond({ tag_name: 'v9.0.0', html_url: 'https://evil.example/download' })
    expect(await fetchLatestRelease(fetchFn, '0.11.0')).toEqual({ kind: 'failed' })
  })
})
