import { describe, it, expect } from 'vitest'
import { buildLlmsTxt } from '../../website/scripts/llmsTxt.mjs'

type LlmsInput = Parameters<typeof buildLlmsTxt>[0]
type LlmsPage = LlmsInput['pages'][number]

function llmsInput(overrides: Partial<LlmsInput> = {}): LlmsInput {
  return {
    baseUrl: 'https://talyx.app',
    summary: 'Talyx is a free desktop app for your AI bots.',
    pages: [],
    links: [],
    ...overrides
  }
}

/** A page whose title and description are told apart by its route. */
function page(route: string): LlmsPage {
  return { route, title: `Title ${route}`, description: `About ${route}.`, canonical: route }
}

/** The lines under one `## ` heading, up to the next blank line. */
function section(text: string, heading: string): string[] {
  const lines = text.split('\n')
  const start = lines.indexOf(`## ${heading}`) + 1
  return lines.slice(start, lines.indexOf('', start))
}

describe('website llms.txt', () => {
  describe('buildLlmsTxt', () => {
    it('should name the site and sum it up when there are no pages', () => {
      const text = buildLlmsTxt(llmsInput())

      expect(text.startsWith('# Talyx\n\n> Talyx is a free desktop app for your AI bots.\n')).toBe(
        true
      )
      expect(section(text, 'Pages')).toEqual([])
      expect(section(text, 'Download and source')).toEqual([])
      expect(section(text, 'Optional')).toEqual([])
    })

    it('should list one page with its title, address and description', () => {
      const text = buildLlmsTxt(llmsInput({ pages: [page('/roadmap')] }))

      expect(section(text, 'Pages')).toEqual([
        '- [Title /roadmap](https://talyx.app/roadmap): About /roadmap.'
      ])
    })

    it('should keep many pages in the order the site lists them', () => {
      const routes = ['/', '/features/roster', '/features/manager', '/roadmap', '/pricing']
      const text = buildLlmsTxt(llmsInput({ pages: routes.map(page) }))

      expect(section(text, 'Pages').map((line) => line.split(']')[0])).toEqual(
        routes.map((route) => `- [Title ${route}`)
      )
    })

    it('should give the home page the bare site address', () => {
      const text = buildLlmsTxt(llmsInput({ pages: [page('/')] }))

      expect(section(text, 'Pages')).toEqual(['- [Title /](https://talyx.app): About /.'])
    })

    it('should list the legal pages under Optional and nowhere else', () => {
      const text = buildLlmsTxt(
        llmsInput({ pages: [page('/'), page('/legal/terms'), page('/legal/privacy')] })
      )

      expect(section(text, 'Pages')).toEqual(['- [Title /](https://talyx.app): About /.'])
      expect(section(text, 'Optional')).toEqual([
        '- [Title /legal/terms](https://talyx.app/legal/terms): About /legal/terms.',
        '- [Title /legal/privacy](https://talyx.app/legal/privacy): About /legal/privacy.'
      ])
    })

    it('should list the download and source links by their labels', () => {
      const text = buildLlmsTxt(
        llmsInput({ links: [{ label: 'Source on GitHub', href: 'https://example.com/repo' }] })
      )

      expect(section(text, 'Download and source')).toEqual([
        '- [Source on GitHub](https://example.com/repo)'
      ])
    })

    it('should end with exactly one newline', () => {
      const text = buildLlmsTxt(llmsInput({ pages: [page('/legal/terms')] }))

      expect(text.endsWith('.\n')).toBe(true)
    })
  })
})
