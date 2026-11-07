import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getVersion: () => '0.11.0' }, BrowserWindow: class {} }))
vi.mock('electron-log', () => ({ default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }))

import {
  fetchLatestRelease,
  isNewerVersion,
  type ReleaseCheck
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
          automatic: false,
          downloadable: false
        },
        asset: null,
        checksums: null
      }
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

    async function found(body: unknown): Promise<Extract<ReleaseCheck, { kind: 'available' }>> {
      const check = await fetchLatestRelease(respond(body), '0.11.0', mac)
      if (check.kind !== 'available') throw new Error('expected an available release')
      return check
    }

    it('should ignore an asset whose URL climbs out of the repository with dot segments', async () => {
      const escape = `${DOWNLOAD}../../../../evil/repo/releases/download/Talyx-arm64.dmg`
      const { release: r } = await found(
        release([asset('Talyx-arm64.dmg', escape), asset('SHA256SUMS')])
      )
      expect(r.asset).toBeNull()
      expect(r.summary.downloadable).toBe(false)
    })

    it('should read the date, highlights, change count and the installer for this computer', async () => {
      const { release: r } = await found(
        release([asset('Talyx-arm64.dmg'), asset('Talyx-x64.dmg'), asset('SHA256SUMS')])
      )
      expect(r.summary).toEqual({
        version: '1.0.0',
        url: `${RELEASE_PAGE}v1.0.0`,
        publishedAt: '2026-11-05T10:00:00Z',
        highlights: [{ lead: 'Update button.', text: 'Shows new releases.' }],
        changes: 2,
        automatic: false,
        downloadable: true
      })
      expect(r.asset).toEqual({
        name: 'Talyx-arm64.dmg',
        url: `${DOWNLOAD}Talyx-arm64.dmg`,
        size: 42
      })
      expect(r.checksums?.name).toBe('SHA256SUMS')
    })

    it('should not be downloadable without a SHA256SUMS asset', async () => {
      const { release: r } = await found(release([asset('Talyx-arm64.dmg')]))
      expect(r.summary.downloadable).toBe(false)
      expect(r.checksums).toBeNull()
    })

    it('should not be downloadable without an installer for this computer', async () => {
      const { release: r } = await found(release([asset('Talyx-x64.dmg'), asset('SHA256SUMS')]))
      expect(r.summary.downloadable).toBe(false)
      expect(r.asset).toBeNull()
    })

    it('should drop assets that are not served from the Talyx repository', async () => {
      const evil = 'https://evil.example/Talyx-arm64.dmg'
      const { release: r } = await found(
        release([asset('Talyx-arm64.dmg', evil), asset('SHA256SUMS', 'https://evil.example/s')])
      )
      expect(r.asset).toBeNull()
      expect(r.checksums).toBeNull()
      expect(r.summary.downloadable).toBe(false)
    })

    it('should ignore malformed asset entries and a missing body', async () => {
      const { release: r } = await found(
        release([null, { name: 5 }, asset('Talyx-arm64.dmg')], { body: undefined })
      )
      expect(r.asset?.name).toBe('Talyx-arm64.dmg')
      expect(r.summary.highlights).toEqual([])
      expect(r.summary.changes).toBe(0)
    })

    it.each([
      [true, 'Talyx-x86_64.AppImage'],
      [false, null]
    ])('should download on Linux only for an AppImage (appImage %s)', async (appImage, name) => {
      const linux = { platform: 'linux', arch: 'x64', appImage } as const
      const body = release([
        asset('Talyx-x86_64.AppImage'),
        asset('Talyx-amd64.deb'),
        asset('SHA256SUMS')
      ])
      const check = await fetchLatestRelease(respond(body), '0.11.0', linux)
      if (check.kind !== 'available') throw new Error('expected an available release')
      expect(check.release.asset?.name ?? null).toBe(name)
      expect(check.release.summary.downloadable).toBe(appImage)
    })

    describe('self-updating installs', () => {
      const linux = (appImage: boolean) => ({ platform: 'linux', arch: 'x64', appImage }) as const
      const feeds = [asset('latest-mac.yml'), asset('latest-linux.yml')]

      it.each([
        ['a Mac', mac, true],
        ['an AppImage', linux(true), true],
        ['a deb install', linux(false), false],
        ['Windows', { platform: 'win32', arch: 'x64', appImage: false } as const, false]
      ])('should update %s by itself: %s', async (_name, target, automatic) => {
        const check = await fetchLatestRelease(respond(release(feeds)), '0.11.0', target)
        if (check.kind !== 'available') throw new Error('expected an available release')
        expect(check.release.summary.automatic).toBe(automatic)
        expect(check.release.summary.downloadable).toBe(automatic)
      })

      it('should fall back to the installer download when the release has no feed', async () => {
        const { release: r } = await found(release([asset('Talyx-arm64.dmg'), asset('SHA256SUMS')]))
        expect(r.summary.automatic).toBe(false)
        expect(r.summary.downloadable).toBe(true)
      })

      it("should not read another platform's feed", async () => {
        const { release: r } = await found(release([asset('latest-linux.yml')]))
        expect(r.summary.automatic).toBe(false)
      })
    })

    it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
      'should drop an asset whose size is %s',
      async (size) => {
        const { release: r } = await found(
          release([{ ...asset('Talyx-arm64.dmg'), size }, asset('SHA256SUMS')])
        )
        expect(r.asset).toBeNull()
      }
    )
  })
})
