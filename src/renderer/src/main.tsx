import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './app/ErrorBoundary'
import { installBrowserBridge } from './app/browser-bridge'
import { reportError } from './shared/lib/report'

installBrowserBridge()

// What no handler caught still reaches the log, so a failure is never silent.
window.addEventListener('error', (event) => reportError('window', event.error ?? event.message))
window.addEventListener('unhandledrejection', (event) => reportError('promise', event.reason))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary scope="app" whole>
      <App />
    </ErrorBoundary>
  </StrictMode>
)
