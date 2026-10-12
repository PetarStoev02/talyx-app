import { createRoot } from 'react-dom/client'
import './demo.css'
import { installDemoApi } from './demoApi'
import type { DemoView } from './DemoApp'

installDemoApi()

const focus = HTMLElement.prototype.focus
HTMLElement.prototype.focus = function (options?: FocusOptions) {
  focus.call(this, { ...options, preventScroll: true })
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
