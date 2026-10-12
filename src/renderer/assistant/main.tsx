import '../src/assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { installBrowserBridge } from '../src/app/browser-bridge'
import { AssistantApp } from './AssistantApp'

// Lets the overlay be opened at http://localhost:5173/assistant.html during npm run dev
installBrowserBridge()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AssistantApp />
  </StrictMode>
)
