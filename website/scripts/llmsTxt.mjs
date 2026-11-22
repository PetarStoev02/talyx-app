const MAIN_TAIL = ['/roadmap', '/press', '/pricing', '/contact']
const LEGAL_PREFIX = '/legal/'

/**
 * @param {{
 *   baseUrl: string
 *   summary: string
 *   pages: { route: string, title: string, description: string, canonical: string }[]
 *   downloadLinks: { title: string, href: string, description: string }[]
 * }} input
 * @returns {string}
 */
export function buildLlmsTxt({ baseUrl, summary, pages, downloadLinks }) {
  const pageByRoute = new Map(pages.map((page) => [page.route, page]))

  const absolute = (canonical) => (canonical === '/' ? baseUrl : `${baseUrl}${canonical}`)
  const line = (title, url, description) => `- [${title}](${url}): ${description}`

  const lines = ['# Talyx', '', `> ${summary}`, '', '## Pages']

  const featureRoutes = pages
    .filter((page) => page.route.startsWith('/features/'))
    .map((page) => page.route)
  const mainRoutes = ['/', ...featureRoutes, ...MAIN_TAIL]

  for (const route of mainRoutes) {
    const page = pageByRoute.get(route)
    if (page) lines.push(line(page.title, absolute(page.canonical), page.description))
  }

  lines.push('', '## Download and source')
  for (const link of downloadLinks) {
    lines.push(line(link.title, link.href, link.description))
  }

  lines.push('', '## Optional')
  for (const page of pages) {
    if (!page.route.startsWith(LEGAL_PREFIX)) continue
    lines.push(line(page.title, absolute(page.canonical), page.description))
  }

  return `${lines.join('\n')}\n`
}
