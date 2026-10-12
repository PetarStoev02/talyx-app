import { describe, it, expect, vi } from 'vitest'
import { homedir } from 'os'
import { join } from 'path'
import { CapabilityRegistry } from '../../../../src/main/domain/instruction/model/CapabilityRegistry'
import {
  desktopCapabilities,
  FIND_FILE_LIMIT,
  type DesktopCapabilityDeps
} from '../../../../src/main/domain/instruction/capabilities/desktop'
import type { CapabilityContext } from '../../../../src/main/domain/instruction/model/Capability'

const ctx: CapabilityContext = {
  home: '/Users/test',
  projectsRoot: '/Users/test/Code',
  signal: new AbortController().signal,
  logger: { info: () => {}, warn: () => {} }
}

function deps(overrides: Partial<DesktopCapabilityDeps> = {}): DesktopCapabilityDeps {
  return {
    openApp: vi.fn(async () => {}),
    openExternal: vi.fn(async () => {}),
    findByName: vi.fn(async (_q, limit) => Array.from({ length: limit + 5 }, (_, i) => `/f/${i}`)),
    recentFiles: vi.fn(async () => [
      {
        path: '/Users/test/Documents/budget.xlsx',
        name: 'budget.xlsx',
        lastUsedAt: '2026-09-15T08:00:00.000Z'
      },
      {
        path: '/Users/test/Desktop/notes.md',
        name: 'notes.md',
        lastUsedAt: '2026-09-14T20:00:00.000Z'
      }
    ]),
    music: vi.fn(async () => 'Daft Punk — Around the World'),
    latestScreenshot: vi.fn(async () => ({
      path: '/Users/test/Desktop/Screenshot 2026-09-15 at 08.31.22.png',
      name: 'Screenshot 2026-09-15 at 08.31.22.png',
      takenAt: '2026-09-15T08:31:22.000Z'
    })),
    now: () => new Date('2026-09-15T10:00:00.000Z'),
    ...overrides
  }
}

describe('open_app', () => {
  it('should label with and without a path and open on execute', async () => {
    const d = deps()
    const cap = new CapabilityRegistry(desktopCapabilities(d)).get('open_app')!
    const bare = await cap.plan(cap.params.parse({ name: 'Notes' }), ctx)
    const withPath = await cap.plan(
      cap.params.parse({ name: 'Visual Studio Code', path: '~/Code/talyx' }),
      ctx
    )
    if (bare.kind !== 'plan' || withPath.kind !== 'plan') throw new Error('expected plans')
    expect(bare.operations[0].label).toBe('open Notes')
    expect(withPath.operations[0].label).toBe(
      `open Visual Studio Code with ${join(homedir(), 'Code/talyx')}`
    )
    await cap.execute!(withPath.operations[0], ctx)
    expect(d.openApp).toHaveBeenCalledWith('Visual Studio Code', join(homedir(), 'Code/talyx'))
  })
})

describe('open_url', () => {
  it.each(['file:///etc/passwd', 'javascript:alert(1)', 'ftp://x'])(
    'should reject %s at the boundary',
    (url) => {
      const cap = new CapabilityRegistry(desktopCapabilities(deps())).get('open_url')!
      expect(cap.params.safeParse({ url }).success).toBe(false)
    }
  )

  it('should open an https url on execute', async () => {
    const d = deps()
    const cap = new CapabilityRegistry(desktopCapabilities(d)).get('open_url')!
    const proposal = await cap.plan(cap.params.parse({ url: 'https://github.com' }), ctx)
    if (proposal.kind !== 'plan') throw new Error('expected plan')
    expect(proposal.operations[0].label).toBe('open https://github.com')
    await cap.execute!(proposal.operations[0], ctx)
    expect(d.openExternal).toHaveBeenCalledWith('https://github.com')
  })
})

describe('find_file', () => {
  it('should answer with at most the limit and say how many', async () => {
    const d = deps()
    const cap = new CapabilityRegistry(desktopCapabilities(d)).get('find_file')!
    const proposal = await cap.plan(cap.params.parse({ query: 'invoice' }), ctx)
    if (proposal.kind !== 'answer') throw new Error('expected answer')
    expect(d.findByName).toHaveBeenCalledWith('invoice', FIND_FILE_LIMIT)
    expect(proposal.evidence).toHaveLength(FIND_FILE_LIMIT)
    expect(proposal.summary).toBe(`First ${FIND_FILE_LIMIT} files named like "invoice"`)
  })

  it('should attach a file card with one entry per hit', async () => {
    const d = deps()
    d.findByName = async () => ['/Users/p/Documents/invoice-2025.pdf']
    const cap = new CapabilityRegistry(desktopCapabilities(d)).get('find_file')!
    const proposal = await cap.plan(cap.params.parse({ query: 'invoice' }), ctx)
    if (proposal.kind !== 'answer') throw new Error('expected answer')
    expect(proposal.card).toEqual({
      kind: 'paths',
      entries: [
        {
          path: '/Users/p/Documents/invoice-2025.pdf',
          label: 'invoice-2025.pdf',
          snippet: null,
          isDirectory: false
        }
      ]
    })
  })

  it('should say when nothing matches', async () => {
    const d = deps()
    d.findByName = async () => []
    const cap = new CapabilityRegistry(desktopCapabilities(d)).get('find_file')!
    const proposal = await cap.plan(cap.params.parse({ query: 'zzz' }), ctx)
    expect(proposal.summary).toBe('No files named like "zzz"')
  })
})

describe('open_recent', () => {
  it('should list recently used files with how long ago and attach a card', async () => {
    const d = deps()
    const cap = new CapabilityRegistry(desktopCapabilities(d)).get('open_recent')!
    const proposal = await cap.plan(cap.params.parse({}), ctx)
    if (proposal.kind !== 'answer') throw new Error('expected answer')
    expect(d.recentFiles).toHaveBeenCalledWith(24, 20)
    expect(proposal.summary).toBe('2 files used in the last 24 hours')
    expect(proposal.evidence.map((e) => e.text)).toEqual([
      'budget.xlsx · 2 hours ago',
      'notes.md · 14 hours ago'
    ])
    expect(proposal.card).toEqual({
      kind: 'paths',
      entries: [
        {
          path: '/Users/test/Documents/budget.xlsx',
          label: 'budget.xlsx',
          snippet: '2 hours ago',
          isDirectory: false
        },
        {
          path: '/Users/test/Desktop/notes.md',
          label: 'notes.md',
          snippet: '14 hours ago',
          isDirectory: false
        }
      ]
    })
  })

  it('should pass a wider window through', async () => {
    const d = deps()
    const cap = new CapabilityRegistry(desktopCapabilities(d)).get('open_recent')!
    const proposal = await cap.plan(cap.params.parse({ hours: 72 }), ctx)
    expect(d.recentFiles).toHaveBeenCalledWith(72, 20)
    expect(proposal.summary).toBe('2 files used in the last 3 days')
  })
})

describe('music_control', () => {
  it('should propose the action and report what is playing after it', async () => {
    const d = deps()
    const cap = new CapabilityRegistry(desktopCapabilities(d)).get('music_control')!
    const proposal = await cap.plan(cap.params.parse({ action: 'play', query: 'daft punk' }), ctx)
    if (proposal.kind !== 'plan') throw new Error('expected plan')
    expect(proposal.operations[0]).toMatchObject({
      label: 'Play "daft punk"',
      payload: { action: 'play', query: 'daft punk' },
      inverse: { action: 'pause', query: null }
    })
    expect(await cap.execute!(proposal.operations[0], ctx)).toBe(
      'Now playing: Daft Punk — Around the World'
    )
    expect(d.music).toHaveBeenCalledWith('play', 'daft punk')
  })

  it.each([
    ['pause', 'Pause the music', 'play'],
    ['next', 'Next track', 'previous'],
    ['previous', 'Previous track', 'next']
  ] as const)('should label %s and invert it', async (action, label, inverse) => {
    const cap = new CapabilityRegistry(desktopCapabilities(deps())).get('music_control')!
    const proposal = await cap.plan(cap.params.parse({ action }), ctx)
    if (proposal.kind !== 'plan') throw new Error('expected plan')
    expect(proposal.operations[0].label).toBe(label)
    expect(proposal.operations[0].inverse).toEqual({ action: inverse, query: null })
  })
})

describe('last_screenshot', () => {
  it('should point at the newest screenshot with how long ago it was taken', async () => {
    const d = deps()
    const cap = new CapabilityRegistry(desktopCapabilities(d)).get('last_screenshot')!
    const proposal = await cap.plan(cap.params.parse({}), ctx)
    if (proposal.kind !== 'answer') throw new Error('expected answer')
    expect(proposal.summary).toBe('Your last screenshot — 1 hour ago')
    expect(proposal.evidence).toEqual([
      {
        source: '/Users/test/Desktop/Screenshot 2026-09-15 at 08.31.22.png',
        text: 'Screenshot 2026-09-15 at 08.31.22.png'
      }
    ])
    expect(proposal.card).toEqual({
      kind: 'paths',
      entries: [
        {
          path: '/Users/test/Desktop/Screenshot 2026-09-15 at 08.31.22.png',
          label: 'Screenshot 2026-09-15 at 08.31.22.png',
          snippet: '1 hour ago',
          isDirectory: false
        }
      ]
    })
  })

  it('should say so when this Mac has no screenshots', async () => {
    const d = deps({ latestScreenshot: vi.fn(async () => null) })
    const cap = new CapabilityRegistry(desktopCapabilities(d)).get('last_screenshot')!
    const proposal = await cap.plan(cap.params.parse({}), ctx)
    if (proposal.kind !== 'answer') throw new Error('expected answer')
    expect(proposal.summary).toBe('No screenshots on this Mac')
    expect(proposal.evidence).toEqual([])
    expect(proposal.card).toBeUndefined()
  })

  it('should stay a read so it never asks for approval', () => {
    const cap = new CapabilityRegistry(desktopCapabilities(deps())).get('last_screenshot')!
    expect(cap.effect.world).toBe('reads')
  })
})
