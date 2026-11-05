import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getVersion: () => '1.0.0' }, BrowserWindow: class {} }))
vi.mock('electron-log', () => ({ default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }))

import {
  countChanges,
  parseHighlights,
  pickAsset,
  type ReleaseAsset
} from '../../../src/main/infrastructure/updater/releaseCheck'

describe('parseHighlights', () => {
  it('should return nothing when the body has no Highlights section', () => {
    expect(parseHighlights("## What's Changed\n- **Not a highlight.** Ignored.")).toEqual([])
  })

  it('should read one bold lead and its text', () => {
    const body = '## Highlights\n- **Update button.** Talyx tells you about new releases.\n'
    expect(parseHighlights(body)).toEqual([
      { lead: 'Update button.', text: 'Talyx tells you about new releases.' }
    ])
  })

  it('should keep at most three highlights', () => {
    const body = [1, 2, 3, 4].map((n) => `- **L${n}.** T${n}.`).join('\n')
    const found = parseHighlights(`## Highlights\n${body}`)
    expect(found.map((h) => h.lead)).toEqual(['L1.', 'L2.', 'L3.'])
  })

  it('should skip lines that are not a bold lead plus text', () => {
    const body = [
      '## Highlights',
      'plain paragraph',
      '- no bold here',
      '- **Only a lead.**',
      '- **Good.** Kept.'
    ].join('\n')
    expect(parseHighlights(body)).toEqual([{ lead: 'Good.', text: 'Kept.' }])
  })

  it('should stop at the next section and read Windows line endings', () => {
    const body = '## Highlights\r\n- **One.** First.\r\n\r\n## Other\r\n- **Two.** Second.\r\n'
    expect(parseHighlights(body)).toEqual([{ lead: 'One.', text: 'First.' }])
  })
})

describe('countChanges', () => {
  it('should be zero without a What is Changed section', () => {
    expect(countChanges('## Highlights\n- **A.** b.')).toBe(0)
  })

  it('should count the bullets under What is Changed only', () => {
    const body = [
      '## Highlights',
      '- **A.** b.',
      "## What's Changed",
      '* fix: one by @a in #1',
      '* feat: two by @b in #2',
      '',
      '**Full Changelog**: https://example.test/compare',
      '## Other',
      '- not counted'
    ].join('\n')
    expect(countChanges(body)).toBe(2)
  })
})

describe('pickAsset', () => {
  const asset = (name: string): ReleaseAsset => ({ name, url: `https://x.test/${name}`, size: 1 })
  const all = [
    asset('SHA256SUMS'),
    asset('Talyx-arm64.dmg'),
    asset('Talyx-x64.dmg'),
    asset('Talyx-Setup.exe'),
    asset('Talyx-x64.AppImage'),
    asset('Talyx-arm64.AppImage')
  ]

  it.each([
    ['darwin', 'arm64', 'Talyx-arm64.dmg'],
    ['darwin', 'x64', 'Talyx-x64.dmg'],
    ['win32', 'x64', 'Talyx-Setup.exe'],
    ['linux', 'arm64', 'Talyx-arm64.AppImage'],
    ['linux', 'x64', 'Talyx-x64.AppImage']
  ] as const)('should pick the installer for %s %s', (platform, arch, name) => {
    expect(pickAsset(all, platform, arch)?.name).toBe(name)
  })

  it('should not hand a mac the other architecture', () => {
    expect(pickAsset([asset('Talyx-x64.dmg')], 'darwin', 'arm64')).toBeNull()
  })

  it.each([
    ['linux', 'x64', ['Talyx-aarch64.AppImage', 'Talyx.AppImage'], 'Talyx.AppImage'],
    ['linux', 'x64', ['Talyx-x86_64.AppImage', 'Talyx-arm64.AppImage'], 'Talyx-x86_64.AppImage'],
    [
      'linux',
      'x64',
      ['Talyx-amd64.deb', 'Talyx-x86_64.AppImage', 'SHA256SUMS'],
      'Talyx-x86_64.AppImage'
    ],
    [
      'linux',
      'arm64',
      ['Talyx-x86_64.AppImage', 'Talyx-aarch64.AppImage'],
      'Talyx-aarch64.AppImage'
    ],
    ['win32', 'arm64', ['Talyx-Setup-x64.exe', 'Talyx-Setup-arm64.exe'], 'Talyx-Setup-arm64.exe']
  ] as const)('should match %s %s by its other names in %j', (platform, arch, names, name) => {
    expect(pickAsset(names.map(asset), platform, arch)?.name).toBe(name)
  })

  it.each([
    ['linux', 'arm64', ['Talyx-x86_64.AppImage']],
    ['linux', 'x64', ['Talyx-amd64.AppImage', 'Talyx-x64.AppImage']],
    ['win32', 'arm64', ['Talyx-Setup-x64.exe', 'Talyx-Setup-ia32.exe']],
    ['win32', 'x64', ['Talyx-Setup.exe', 'Talyx-Portable.exe']]
  ] as const)('should not guess on %s %s from %j', (platform, arch, names) => {
    expect(pickAsset(names.map(asset), platform, arch)).toBeNull()
  })

  it('should return null for a platform without an installer', () => {
    expect(pickAsset(all, 'freebsd', 'x64')).toBeNull()
    expect(pickAsset([asset('SHA256SUMS')], 'linux', 'x64')).toBeNull()
  })
})
