import { describe, it, expect } from 'vitest'
import { buildLlmsTxt } from '../../website/scripts/llmsTxt.mjs'

const BASE_URL = 'https://talyx.app'

interface LlmsPage {
  route: string
  title: string
  description: string
  canonical: string
}

interface LlmsDownloadLink {
  title: string
  href: string
  description: string
}

interface LlmsInput {
  summary: string
  pages: LlmsPage[]
  downloadLinks: LlmsDownloadLink[]
}

function llmsInput(overrides: Partial<LlmsInput> = {}): LlmsInput & { baseUrl: string } {
  return {
    baseUrl: BASE_URL,
    summary: 'Talyx is a free desktop app for your AI bots.',
    pages: [],
    downloadLinks: [],
    ...overrides
  }
}

function page(
  route: string,
  title: string,
  description: string,
  canonical: string = route
): LlmsPage {
  return { route, title, description, canonical }
}

describe('website llms.txt', () => {
  describe('buildLlmsTxt', () => {
    it('should still produce a valid file with only the name and summary when there are zero pages', () => {
      const text = buildLlmsTxt(llmsInput({ pages: [] }))

      expect(text).toMatch(/^# Talyx\n\n> /)
      expect(text).toContain('> Talyx is a free desktop app for your AI bots.')
      expect(text).not.toContain('## Pages\n- ')
    })

    it('should list a single page under Pages', () => {
      const text = buildLlmsTxt(
        llmsInput({
          pages: [page('/', 'Talyx home', 'The landing page.')]
        })
      )

      expect(text).toContain('## Pages')
      expect(text).toContain('- [Talyx home](https://talyx.app): The landing page.')
    })

    it('should order many pages as home, features, then site pages', () => {
      const pages = [
        page('/legal/privacy', 'Privacy Policy', 'Privacy policy copy.', '/legal/privacy'),
        page('/contact', 'Contact', 'Contact copy.', '/contact'),
        page('/features/roster', 'Roster', 'Roster copy.', '/features/roster'),
        page('/', 'Talyx home', 'Home copy.', '/'),
        page('/roadmap', 'Roadmap', 'Roadmap copy.', '/roadmap'),
        page('/features/manager', 'Manager', 'Manager copy.', '/features/manager'),
        page('/press', 'Press', 'Press copy.', '/press'),
        page('/pricing', 'Pricing', 'Pricing copy.', '/pricing')
      ]
      const text = buildLlmsTxt(llmsInput({ pages }))

      const pagesSection = text.split('## Download and source')[0] ?? ''
      const rosterAt = pagesSection.indexOf('- [Roster]')
      const managerAt = pagesSection.indexOf('- [Manager]')
      const roadmapAt = pagesSection.indexOf('- [Roadmap]')
      const pressAt = pagesSection.indexOf('- [Press]')
      const pricingAt = pagesSection.indexOf('- [Pricing]')
      const contactAt = pagesSection.indexOf('- [Contact]')
      const homeAt = pagesSection.indexOf('- [Talyx home]')

      expect(homeAt).toBeGreaterThan(-1)
      expect(homeAt).toBeLessThan(rosterAt)
      expect(rosterAt).toBeLessThan(managerAt)
      expect(managerAt).toBeLessThan(roadmapAt)
      expect(roadmapAt).toBeLessThan(pressAt)
      expect(pressAt).toBeLessThan(pricingAt)
      expect(pricingAt).toBeLessThan(contactAt)
    })

    it('should list legal pages only under Optional', () => {
      const pages = [
        page('/', 'Home', 'Home copy.'),
        page('/legal/terms', 'Terms', 'Terms copy.', '/legal/terms'),
        page('/legal/privacy', 'Privacy', 'Privacy copy.', '/legal/privacy')
      ]
      const text = buildLlmsTxt(llmsInput({ pages }))
      const pagesBlock = text.split('## Download and source')[0] ?? ''
      const optionalBlock = text.split('## Optional')[1] ?? ''

      expect(pagesBlock).not.toContain('/legal/')
      expect(optionalBlock).toContain('- [Terms](https://talyx.app/legal/terms): Terms copy.')
      expect(optionalBlock).toContain('- [Privacy](https://talyx.app/legal/privacy): Privacy copy.')
    })

    it('should use the site root URL for the home page with no trailing path', () => {
      const text = buildLlmsTxt(
        llmsInput({
          pages: [page('/', 'Home', 'Home copy.')]
        })
      )

      expect(text).toContain('](https://talyx.app):')
      expect(text).not.toContain('](https://talyx.app/):')
    })

    it('should use absolute URLs for every link', () => {
      const text = buildLlmsTxt(
        llmsInput({
          pages: [
            page('/roadmap', 'Roadmap', 'Roadmap copy.'),
            page('/legal/terms', 'Terms', 'Terms copy.', '/legal/terms')
          ],
          downloadLinks: [
            {
              title: 'Source on GitHub',
              href: 'https://github.com/PetarStoev02/talyx-app',
              description: 'The repository.'
            }
          ]
        })
      )

      for (const url of text.match(/\]\(([^)]+)\)/g) ?? []) {
        const href = url.slice(2, -1)
        expect(href).toMatch(/^https:\/\//)
      }
    })

    it('should end with exactly one newline', () => {
      const text = buildLlmsTxt(llmsInput())

      expect(text.endsWith('\n')).toBe(true)
      expect(text.endsWith('\n\n')).toBe(false)
    })
  })
})
