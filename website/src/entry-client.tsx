import { StrictMode } from 'react'
import { hydrateRoot, createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { router } from './app/router'
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

if (root.firstElementChild) {
  // The prerender ran after router.load(); hydrating before it would render no matches yet.
  // A failed load still hydrates, so the page stays interactive.
  void router.load().finally(() =>
    hydrateRoot(
      root,
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>
    )
  )
} else {
  createRoot(root).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  )
}
