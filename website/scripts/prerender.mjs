import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, '..', 'dist')

const basepath = ''
const baseUrl = 'https://talyx.app'

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function replaceMeta(template, meta) {
  const ogTitle = meta.ogTitle || meta.title
  const ogDescription = meta.ogDescription || meta.description
  const canonical = meta.canonical === '/' ? baseUrl : `${baseUrl}${meta.canonical}`
  const ogUrl = canonical
  const e = escapeHtml

  // Tags in index.html may span several lines (prettier), so match with \s+ and the s flag
  const metaTag = (attr, key, value) => [
    new RegExp(`<meta\\s+${attr}="${key}"\\s+content="[^"]*"\\s*/?>`, 's'),
    `<meta ${attr}="${key}" content="${e(value)}" />`
  ]
  const replacements = [
    [/<title>[^<]*<\/title>/, `<title>${e(meta.title)}</title>`],
    metaTag('name', 'description', meta.description),
    metaTag('property', 'og:title', ogTitle),
    metaTag('property', 'og:description', ogDescription),
    metaTag('property', 'og:url', ogUrl),
    metaTag('name', 'twitter:title', ogTitle),
    metaTag('name', 'twitter:description', ogDescription),
    [
      /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/s,
      `<link rel="canonical" href="${e(canonical)}" />`
    ]
  ]

  let result = replacements.reduce(
    (html, [pattern, tag]) => html.replace(pattern, () => tag),
    template
  )

  if (meta.jsonLd && meta.jsonLd.length > 0) {
    const jsonLdTags = meta.jsonLd
      .map((data) => `<script type="application/ld+json">${JSON.stringify(data)}</script>`)
      .join('\n    ')
    result = result.replace('<!--seo:jsonld-->', jsonLdTags)
  } else {
    result = result.replace('<!--seo:jsonld-->', '')
  }

  return result
}

async function prerender() {
  const { render, ROUTES: routes } = await import(join(distDir, 'server', 'entry-server.js'))
  const template = readFileSync(join(distDir, 'index.html'), 'utf-8')

  console.log('Pre-rendering static pages...\n')

  for (const route of routes) {
    const url = basepath + (route === '/' ? '/' : route)
    const { html, meta } = await render(url)
    // React puts the resources it preloads (the hero's eager images) ahead of the app's markup;
    // inside #root they would not hydrate, so they go to the head.
    const [, hoisted, app] = html.match(/^((?:<link [^>]*>)*)([\s\S]*)$/)
    const shell = template.replace('</head>', `${hoisted}</head>`).replace('<!--ssr-outlet-->', app)
    const page = replaceMeta(shell, meta)

    if (route === '/') {
      writeFileSync(join(distDir, 'index.html'), page)
    } else {
      const dir = join(distDir, ...route.split('/').filter(Boolean))
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, 'index.html'), page)
    }

    console.log(`  Pre-rendered: ${route}`)
  }

  // Generate sitemap.xml
  const today = new Date().toISOString().split('T')[0]
  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...routes.map((route) => {
      const loc = route === '/' ? baseUrl : `${baseUrl}${route}`
      const priority = route === '/' ? '1.0' : route.startsWith('/features/') ? '0.7' : '0.8'
      const changefreq = route === '/' ? 'weekly' : 'monthly'
      return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`
    }),
    '</urlset>',
    ''
  ].join('\n')

  writeFileSync(join(distDir, 'sitemap.xml'), sitemap)
  console.log(`\n  Generated: sitemap.xml (${routes.length} URLs)`)

  // Generate robots.txt
  const robots = `User-agent: *\nAllow: /\n\nSitemap: https://talyx.app/sitemap.xml\n`
  writeFileSync(join(distDir, 'robots.txt'), robots)
  console.log('  Generated: robots.txt')

  // Clean up SSR bundle
  rmSync(join(distDir, 'server'), { recursive: true, force: true })
  console.log('  Cleaned up: dist/server/\n')

  checkInlineScriptsAllowed()
}

/**
 * The CSP in vercel.json runs inline scripts by hash: the theme scripts in index.html and
 * app-demo.html, and the ones React's prerender writes. An edit to one, or a React upgrade, changes
 * a hash; this fails the build then, instead of shipping a page whose scripts the browser blocks.
 */
function checkInlineScriptsAllowed() {
  const vercel = JSON.parse(readFileSync(join(__dirname, '..', 'vercel.json'), 'utf-8'))
  const csp = vercel.headers
    .flatMap((rule) => rule.headers)
    .find((header) => header.key === 'Content-Security-Policy')?.value
  if (!csp) throw new Error('No Content-Security-Policy header in vercel.json')
  const scriptSrc = csp
    .split(';')
    .map((directive) => directive.trim().split(/\s+/))
    .find(([name]) => name === 'script-src')
  if (!scriptSrc) throw new Error('No script-src directive in the CSP in vercel.json')
  const pages = readdirSync(distDir, { recursive: true }).filter((file) => file.endsWith('.html'))
  const missing = new Set()
  for (const page of pages) {
    const html = readFileSync(join(distDir, page), 'utf-8')
    for (const [, attrs, script] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      // A src script is checked by its origin, and JSON-LD is data the browser never runs.
      if (/\ssrc\s*=/i.test(attrs) || /type\s*=\s*["']?application\/ld\+json/i.test(attrs)) continue
      const hash = `'sha256-${createHash('sha256').update(script).digest('base64')}'`
      if (!scriptSrc.includes(hash)) missing.add(`${hash} (${page})`)
    }
  }
  if (missing.size > 0)
    throw new Error(
      `Inline scripts missing from the CSP in vercel.json:\n  ${[...missing].join('\n  ')}`
    )
  console.log(`  Checked: inline scripts in ${pages.length} pages are in the CSP\n`)
}

prerender().catch((err) => {
  console.error('Pre-render failed:', err)
  process.exit(1)
})
