import { useEffect } from 'react'
import { Toaster } from 'sonner'
import { AppShell } from '@widgets/app-shell'
import { settingsApi } from '@shared/api/ipc'
import { AgentsPage } from '@pages/agents'

// ponytail: every landing-page scene shows the empty agents shell until the website PR
// rebuilds the demo for the pivot; the scene names stay so the landing page keeps compiling.
export type DemoView = 'assistant' | 'suggestions' | 'approval' | 'sort' | 'history' | 'watch'

/** Boot the real app shell for a landing-page scene. */
export function DemoApp({ scene }: { scene: DemoView }): React.JSX.Element {
  useEffect(() => {
    if (scene !== 'assistant') void settingsApi.set({ sidebarCollapsed: true })
  }, [scene])

  return (
    <>
      <AppShell>
        <AgentsPage />
      </AppShell>
      <Toaster position="bottom-center" />
    </>
  )
}
