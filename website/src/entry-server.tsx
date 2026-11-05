import { Suspense } from 'react'
import { prerender } from 'react-dom/static'
import { RouterProvider } from '@tanstack/react-router'
import { createMemoryHistory } from '@tanstack/react-router'
import { createAppRouter } from './app/router'
import { seoData, type PageMeta } from './shared/data/seo'

export { ROUTES } from './shared/data/routes'

/**
 * `prerender` resolves every Suspense boundary before it hands back HTML, so
 * the lazily loaded page and post chunks are in the static output while the
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
