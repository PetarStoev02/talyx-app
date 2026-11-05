import { StrictMode } from 'react'
import { hydrateRoot, createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { router } from './app/router'
import { ROUTES } from './shared/data/routes'
import { startAnalytics } from './shared/analytics'
import './app/styles.css'

declare global {
  interface Window {
    /** Read by index.html's fallback: if it is never set, entrance motion is dropped. */
    __talyxBooted?: boolean
  }
}

console.log(
  '%c\n' +
    '  ████████╗ █████╗ ██╗  ██╗   ██╗██╗  ██╗\n' +
    '  ╚══██╔══╝██╔══██╗██║  ╚██╗ ██╔╝╚██╗██╔╝\n' +
    '     ██║   ███████║██║   ╚████╔╝  ╚███╔╝ \n' +
    '     ██║   ██╔══██║██║    ╚██╔╝   ██╔██╗ \n' +
    '     ██║   ██║  ██║███████╗██║   ██╔╝ ██╗\n' +
    '     ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝   ╚═╝  ╚═╝\n',
  'font-family: monospace; font-size: 12px; color: #000;'
)
console.log(
  '%cBuilt by Petar Stoev',
  'font-family: monospace; font-size: 14px; font-weight: bold; color: #000;'
)
console.log(
  '%c→ GitHub   https://github.com/PetarStoev02\n' + '→ Website  https://www.petarstoev.dev/',
  'font-family: monospace; font-size: 12px; color: #444;'
)

const root = document.getElementById('root')!
window.__talyxBooted = true

// Pages that are not prerendered (/design, a 404) are served the landing page's HTML, which would
// not hydrate; they render fresh instead.
const path = location.pathname.replace(/\/+$/, '') || '/'

if (root.firstElementChild && ROUTES.includes(path)) {
  // The prerender ran after router.load(); hydrating before it would render no matches yet.
  // A failed load still hydrates, so the page stays interactive.
  const hydrate = () => {
    hydrateRoot(
      root,
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>
    )
    startAnalytics()
  }
  void router.load().then(hydrate, hydrate)
} else {
  root.replaceChildren()
  createRoot(root).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  )
  startAnalytics()
}
