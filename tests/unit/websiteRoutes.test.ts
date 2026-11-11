import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { ROUTES } from '../../website/src/shared/data/routes'
import { seoData } from '../../website/src/shared/data/seo'

interface Redirect {
  source: string
  destination: string
}

const { redirects, headers } = JSON.parse(readFileSync('website/vercel.json', 'utf8')) as {
  redirects: Redirect[]
  headers: { source: string; headers: { key: string; value: string }[] }[]
}

const REMOVED = [
  '/blog',
  '/blog/talyx-is-now-free-and-open-source',
  '/blog/meet-the-assistant',
  '/blog/why-we-built-talyx',
  '/blog/organize-downloads-folder',
  '/blog/best-file-organizers-2026',
  '/blog/freelancer-file-organization',
  '/blog/ai-file-organization-explained',
  '/blog/local-ai-image-recognition',
  '/blog/vision-credits-ai-image-recognition',
  ...['knowledge-workers', 'freelancers', 'students', 'legal', 'medical'].map(
    (slug) => `/use-cases/${slug}`
  ),
  ...[
    'ai-classification',
    'watch-folders',
    'smart-rename',
    'sort-history',
    'drag-and-drop',
    'assistant',
    'quick-search',
    'privacy-offline',
    'custom-taxonomies',
    'cross-platform'
  ].map((slug) => `/features/${slug}`),
  '/checkout',
  '/account',
  '/admin'
]

const SUCCESSOR: Record<string, string> = {
  '/features/assistant': '/features/manager',
  '/features/quick-search': '/features/manager',
  '/features/privacy-offline': '/features/privacy',
  '/features/cross-platform': '/#download'
}

function matches(source: string, path: string): boolean {
  if (!source.endsWith('/:path*')) return source === path
  return path.startsWith(source.slice(0, -'/:path*'.length) + '/')
}

function redirectFor(path: string): Redirect | undefined {
  return redirects.find(({ source }) => matches(source, path))
}

describe('website routes', () => {
  describe('removed pages', () => {
    it.each(REMOVED)('should send %s to a live page in one hop', (path) => {
      const redirect = redirectFor(path)

      expect(redirect, `no redirect matches ${path}`).toBeDefined()
      expect(ROUTES).toContain(redirect!.destination.split('#')[0])
    })

    it.each(REMOVED)('should send %s to its successor or the home page', (path) => {
      expect(redirectFor(path)!.destination).toBe(SUCCESSOR[path] ?? '/')
    })
  })

  describe('live pages', () => {
    it('should redirect no live page', () => {
      const sources = redirects.map(({ source }) => source)

      expect(ROUTES.filter((route) => sources.includes(route))).toEqual([])
    })

    it('should point every redirect at a live page', () => {
      const dead = redirects.filter(
        ({ destination }) => !ROUTES.includes(destination.split('#')[0])
      )

      expect(dead).toEqual([])
    })

    it('should keep the design page out of search results', () => {
      const design = headers.find(({ source }) => source === '/design')

      expect(design?.headers).toContainEqual({
        key: 'X-Robots-Tag',
        value: 'noindex, nofollow'
      })
    })

    it('should list the home page, every feature, and the site pages', () => {
      expect(ROUTES).toEqual([
        '/',
        ...[
          'roster',
          'manager',
          'rooms',
          'routines',
          'bot-details',
          'models-and-keys',
          'privacy'
        ].map((slug) => `/features/${slug}`),
        '/roadmap',
        '/press',
        '/pricing',
        '/contact',
        '/legal/terms',
        '/legal/privacy',
        '/legal/refund'
      ])
    })

    it('should give every live page its own title and canonical', () => {
      expect(Object.keys(seoData).sort()).toEqual([...ROUTES].sort())
      for (const route of ROUTES) expect(seoData[route].canonical).toBe(route)

      const titles = ROUTES.map((route) => seoData[route].title)
      expect(new Set(titles).size).toBe(titles.length)
    })
  })
})
