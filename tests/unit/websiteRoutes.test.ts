import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { ROUTES } from '../../website/src/shared/data/routes'

interface Redirect {
  source: string
  destination: string
}

const { redirects } = JSON.parse(readFileSync('website/vercel.json', 'utf8')) as {
  redirects: Redirect[]
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
    'privacy-offline',
    'custom-taxonomies',
    'cross-platform'
  ].map((slug) => `/features/${slug}`),
  '/pricing',
  '/checkout',
  '/account',
  '/admin',
  '/legal/refund'
]

const SUCCESSOR: Record<string, string> = {
  '/features/assistant': '/features/manager',
  '/features/privacy-offline': '/features/privacy',
  '/features/cross-platform': '/#download',
  '/legal/refund': '/legal/terms'
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
        '/contact',
        '/legal/terms',
        '/legal/privacy'
      ])
    })
  })
})
