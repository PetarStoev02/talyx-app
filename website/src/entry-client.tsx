import { StrictMode } from 'react'
import { hydrateRoot, createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { router } from './app/router'
import './app/styles.css'

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

if (root.firstElementChild) {
  hydrateRoot(
    root,
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  )
} else {
  createRoot(root).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  )
}
