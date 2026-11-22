import { Suspense } from 'react'
import { prerender } from 'react-dom/static'
import { RouterProvider } from '@tanstack/react-router'
import { createMemoryHistory } from '@tanstack/react-router'
import { createAppRouter } from './app/router'
import { CTA_LABEL } from './shared/data/offer'
import { DOWNLOAD_GROUP } from './shared/data/navigation'
import { REPO_URL } from './shared/data/release'
import { seoData, type PageMeta } from './shared/data/seo'

export { ROUTES } from './shared/data/routes'

export interface LlmsDownloadLink {
  title: string
  href: string
  description: string
}

/** Titles and URLs for llms.txt come from navigation and the home page JSON-LD in seoData. */
export const LLMS_DOWNLOAD_LINKS: LlmsDownloadLink[] = (() => {
  const home = seoData['/']
  const software = home.jsonLd?.find(
    (item): item is Record<string, unknown> =>
      typeof item === 'object' &&
      item !== null &&
      '@type' in item &&
      item['@type'] === 'SoftwareApplication'
  )
  const repoNav = DOWNLOAD_GROUP.links.find(
    (link): link is { label: string; href: string } => 'href' in link && link.href === REPO_URL
  )
  const codeRepository = software?.['codeRepository']
  const downloadUrl = software?.['downloadUrl']
  const releaseDescription = software?.['description']
  if (
    !repoNav ||
    typeof codeRepository !== 'string' ||
    typeof downloadUrl !== 'string' ||
    typeof releaseDescription !== 'string'
  ) {
    throw new Error('Home page SEO data is missing fields needed for llms.txt download links')
  }
  return [
    { title: repoNav.label, href: codeRepository, description: home.description },
    { title: CTA_LABEL, href: downloadUrl, description: releaseDescription }
  ]
})()

/**
 * `prerender` resolves every Suspense boundary before it hands back HTML, so
 * the lazily loaded page chunks are in the static output while the
 * browser still downloads only the chunk it needs.
 */
export async function render(url: string): Promise<{ html: string; meta: PageMeta }> {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [url] }))
  await router.load()
  // In the browser the router renders its matches inside a Suspense boundary, on the server
  // without one. This boundary puts the same markers in the HTML, so hydration lines up.
  const { prelude } = await prerender(
    <Suspense fallback={null}>
      <RouterProvider router={router} />
    </Suspense>
  )
  const html = await new Response(prelude).text()
  const meta = seoData[url] ?? seoData['/']
  return { html, meta }
}
