const LEGAL_PREFIX = '/legal/'

/**
 * The site's llms.txt (https://llmstxt.org): what Talyx is and where its pages are, for an agent
 * that reads the site. Pages keep the order they are given in; an agent may skip `## Optional`.
 *
 * @param {{
 *   baseUrl: string
 *   summary: string
 *   pages: { route: string, title: string, description: string, canonical: string }[]
 *   links: { label: string, href: string }[]
 * }} input
 * @returns {string}
 */
export function buildLlmsTxt({ baseUrl, summary, pages, links }) {
  const pageLine = ({ title, description, canonical }) =>
    `- [${title}](${canonical === '/' ? baseUrl : `${baseUrl}${canonical}`}): ${description}`
  const legal = (page) => page.route.startsWith(LEGAL_PREFIX)

  return [
    '# Talyx',
    '',
    `> ${summary}`,
    '',
    '## Pages',
    ...pages.filter((page) => !legal(page)).map(pageLine),
    '',
    '## Download and source',
    ...links.map(({ label, href }) => `- [${label}](${href})`),
    '',
    '## Optional',
    ...pages.filter(legal).map(pageLine),
    ''
  ].join('\n')
}
