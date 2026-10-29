import { createRoot } from 'react-dom/client'
import './demo.css'
import { installDemoApi } from './demoApi'
import type { DemoView } from './DemoApp'

installDemoApi()

// Embedded on the landing page, focus() and scrollIntoView() pull the parent
// page down to the frame. Allow them once the visitor has used this frame.
let touched = window === window.top
for (const type of ['pointerdown', 'keydown'])
  window.addEventListener(type, () => (touched = true), { capture: true, once: true })

const focus = HTMLElement.prototype.focus
HTMLElement.prototype.focus = function (options?: FocusOptions) {
  if (touched) focus.call(this, { ...options, preventScroll: true })
}

const scrollIntoView = Element.prototype.scrollIntoView
Element.prototype.scrollIntoView = function (options?: boolean | ScrollIntoViewOptions) {
  if (touched) scrollIntoView.call(this, options)
}

const scene = (new URLSearchParams(location.search).get('view') ?? 'assistant') as DemoView

void Promise.all([import('./DemoApp'), import('@shared/ui/tooltip')]).then(
  ([{ DemoApp }, { TooltipProvider }]) => {
    createRoot(document.getElementById('root')!).render(
      <TooltipProvider>
        <DemoApp scene={scene} />
      </TooltipProvider>
    )
  }
)
