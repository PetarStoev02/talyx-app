import { Suspense } from 'react'
import { prerender } from 'react-dom/static'
import { RouterProvider } from '@tanstack/react-router'
import { createMemoryHistory } from '@tanstack/react-router'
import { createAppRouter } from './app/router'
import { CTA_LABEL } from './shared/data/offer'
import { SOURCE_LINK } from './shared/data/navigation'
import { LATEST_RELEASE_URL } from './shared/data/release'
import { seoData, type PageMeta } from './shared/data/seo'

export { ROUTES } from './shared/data/routes'

/** What llms.txt links to besides the pages, under the names the site gives them. */
export const LLMS_LINKS = [SOURCE_LINK, { label: CTA_LABEL, href: LATEST_RELEASE_URL }]

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
