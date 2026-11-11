import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getVersion: () => '0.11.0' }, BrowserWindow: class {} }))
vi.mock('electron-log', () => ({ default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }))

import {
  fetchLatestRelease,
  isNewerVersion,
  type ReleaseCheck
} from '../../../src/main/infrastructure/updater/releaseCheck'

const FEED = 'https://github.com/PetarStoev02/talyx-app/releases/latest/download/'
const API = 'https://api.github.com/repos/PetarStoev02/talyx-app/releases/latest'

/** The API answers `body`; the update feed answers `feed`, or is missing (a 404) when null. */
function respond(body: unknown, ok = true, feed: string | null = null): typeof fetch {
  return vi.fn(async (url: string) =>
    url.startsWith(FEED)
      ? { ok: feed !== null, status: feed === null ? 404 : 200, text: async () => feed }
      : { ok, status: ok ? 200 : 404, json: async () => body }
  ) as unknown as typeof fetch
}

describe('isNewerVersion', () => {
  it.each([
    ['0.11.1', '0.11.0', true],
    ['0.12.0', '0.11.9', true],
    ['1.0.0', '0.99.99', true],
    ['v0.11.1', '0.11.0', true],
    ['0.11.0', '0.11.0', false],
    ['0.10.9', '0.11.0', false],
    ['not-a-version', '0.11.0', false],
    ['1.0.0', '1.0.0-alpha.1', true],
    ['v1.0.0-alpha.2', '1.0.0-alpha.1', true],
    ['1.0.0-alpha.10', '1.0.0-alpha.9', true],
    ['1.0.0-alpha.1', '1.0.0-alpha.1', false],
    ['1.0.0-alpha.1', '1.0.0', false],
    ['0.11.0', '1.0.0-alpha.1', false]
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
      release: {
        summary: {
          version: '0.11.1',
          url: `${RELEASE_PAGE}v0.11.1`,
          publishedAt: '',
          highlights: [],
          changes: 0,
          downloadable: false
        }
      }
    })
    expect(vi.mocked(fetchFn).mock.calls.at(-1)?.[0]).toBe(API)
  })

  it('should give the fetch a timeout signal so a hung request fails', async () => {
    const fetchFn = respond({ tag_name: 'v0.11.1', html_url: `${RELEASE_PAGE}v0.11.1` })
    await fetchLatestRelease(fetchFn, '0.11.0')
    const init = vi.mocked(fetchFn).mock.calls.at(-1)?.[1]
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

  describe('update feed', () => {
    const mac = { platform: 'darwin', arch: 'arm64', appImage: false } as const
    const deb = { platform: 'linux', arch: 'x64', appImage: false } as const
    const latest = { tag_name: 'v0.12.0', html_url: `${RELEASE_PAGE}v0.12.0` }
    const urls = (fetchFn: typeof fetch): unknown[] =>
      vi.mocked(fetchFn).mock.calls.map((c) => c[0])

    it('should answer up to date from the feed alone, without the rate-limited API', async () => {
      const fetchFn = respond(latest, true, 'version: 0.11.0\nfiles:\n')
      expect(await fetchLatestRelease(fetchFn, '0.11.0', mac)).toEqual({ kind: 'up-to-date' })
      expect(urls(fetchFn)).toEqual([`${FEED}latest-mac.yml`])
    })

    it('should ask the API for the notes only when the feed names a newer version', async () => {
      const fetchFn = respond(latest, true, "version: '0.12.0'\n")
      const check = await fetchLatestRelease(fetchFn, '0.11.0', mac)
      expect(check.kind).toBe('available')
      expect(urls(fetchFn)).toEqual([`${FEED}latest-mac.yml`, API])
    })

    it('should read the Linux feed for a deb install too', async () => {
      const fetchFn = respond(latest, true, 'version: 0.11.0\n')
      expect(await fetchLatestRelease(fetchFn, '0.11.0', deb)).toEqual({ kind: 'up-to-date' })
      expect(urls(fetchFn)).toEqual([`${FEED}latest-linux.yml`])
    })

    it.each([
      ['missing', null],
      ['without a version', 'files: []\n'],
      ['naming no version number', 'version: latest\n']
    ])('should fall back to the API when the feed is %s', async (_name, feed) => {
      const fetchFn = respond(latest, true, feed)
      expect((await fetchLatestRelease(fetchFn, '0.11.0', mac)).kind).toBe('available')
      expect(urls(fetchFn).at(-1)).toBe(API)
    })
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

  describe('release details', () => {
    const DOWNLOAD = 'https://github.com/PetarStoev02/talyx-app/releases/download/v1.0.0/'
    const mac = { platform: 'darwin', arch: 'arm64', appImage: false } as const
    const release = (assets: unknown[], extra: object = {}): unknown => ({
      tag_name: 'v1.0.0',
      html_url: `${RELEASE_PAGE}v1.0.0`,
      published_at: '2026-11-05T10:00:00Z',
      body: "## Highlights\n- **Update button.** Shows new releases.\n## What's Changed\n* a\n* b",
      assets,
      ...extra
    })
    const asset = (name: string, url = `${DOWNLOAD}${name}`): object => ({
      name,
      browser_download_url: url,
      size: 42
    })

    const signedFeed = [asset('latest-mac.yml'), asset('latest-mac.yml.sig')]

    async function found(body: unknown): Promise<Extract<ReleaseCheck, { kind: 'available' }>> {
      const check = await fetchLatestRelease(respond(body), '0.11.0', mac)
      if (check.kind !== 'available') throw new Error('expected an available release')
      return check
    }

    it('should read the date, highlights and change count', async () => {
      const { release: r } = await found(release(signedFeed))
      expect(r.summary).toEqual({
        version: '1.0.0',
        url: `${RELEASE_PAGE}v1.0.0`,
        publishedAt: '2026-11-05T10:00:00Z',
        highlights: [{ lead: 'Update button.', text: 'Shows new releases.' }],
        changes: 2,
        downloadable: true
      })
    })

    it('should ignore malformed asset entries and a missing body', async () => {
      const { release: r } = await found(
        release([null, { name: 5 }, ...signedFeed], { body: undefined })
      )
      expect(r.summary.downloadable).toBe(true)
      expect(r.summary.highlights).toEqual([])
      expect(r.summary.changes).toBe(0)
    })

    describe('what Talyx downloads itself', () => {
      const linux = (appImage: boolean) => ({ platform: 'linux', arch: 'x64', appImage }) as const
      const feeds = [
        ...signedFeed,
        asset('latest-linux.yml'),
        asset('latest-linux.yml.sig'),
        asset('Talyx-arm64.dmg'),
        asset('Talyx-x86_64.AppImage'),
        asset('SHA256SUMS')
      ]

      it.each([
        ['a Mac', mac, true],
        ['an AppImage', linux(true), true],
        ['a deb install', linux(false), false],
        ['Windows', { platform: 'win32', arch: 'x64', appImage: false } as const, false]
      ])('should update %s by itself: %s', async (_name, target, downloadable) => {
        const check = await fetchLatestRelease(respond(release(feeds)), '0.11.0', target)
        if (check.kind !== 'available') throw new Error('expected an available release')
        expect(check.release.summary.downloadable).toBe(downloadable)
      })

      it.each([
        ['has an installer and SHA256SUMS but no feed', ['Talyx-arm64.dmg', 'SHA256SUMS']],
        ['has the feed without its signature', ['latest-mac.yml', 'Talyx-arm64.dmg']],
        ['has the signature without the feed', ['latest-mac.yml.sig']],
        ["has only another platform's signed feed", ['latest-linux.yml', 'latest-linux.yml.sig']]
      ])('should offer only the release page when the release %s', async (_name, names) => {
        const { release: r } = await found(release(names.map((name) => asset(name))))
        expect(r.summary.downloadable).toBe(false)
      })

      it('should not count a feed that is not served from the Talyx repository', async () => {
        const evil = 'https://evil.example/latest-mac.yml'
        const { release: r } = await found(
          release([asset('latest-mac.yml', evil), asset('latest-mac.yml.sig')])
        )
        expect(r.summary.downloadable).toBe(false)
      })

      it('should not count a feed whose URL climbs out of the repository with dot segments', async () => {
        const escape = `${DOWNLOAD}../../../../evil/repo/releases/download/latest-mac.yml`
        const { release: r } = await found(
          release([asset('latest-mac.yml', escape), asset('latest-mac.yml.sig')])
        )
        expect(r.summary.downloadable).toBe(false)
      })
    })
  })
})
