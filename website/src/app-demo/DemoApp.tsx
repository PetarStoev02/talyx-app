import { useEffect } from 'react'
import { Toaster } from 'sonner'
import { AppShell } from '@widgets/app-shell'
import { useNavigation } from '@app/providers/useNavigation'
import { useSortSession } from '@app/providers/useSortSession'
import { useAgent } from '@features/assistant/useAgent'
import { settingsApi } from '@shared/api/ipc'
import { AskPage } from '@pages/ask'
import { SortPage } from '@pages/sort'
import { WatchPage } from '@pages/watch'
import { HistoryPage } from '@pages/history'
import { DEMO_CLASSIFIED } from './demoFixtures'

export type DemoView = 'assistant' | 'suggestions' | 'approval' | 'sort' | 'history' | 'watch'

function DemoRoutes(): React.JSX.Element {
  const view = useNavigation((s) => s.currentView)

  switch (view) {
    case 'sort':
      return <SortPage />
    case 'watch':
      return <WatchPage />
    case 'history':
      return <HistoryPage />
    default:
      return <AskPage />
  }
}

/** Boot the real app shell, then route and seed state for each landing-page scene. */
export function DemoApp({ scene }: { scene: DemoView }): React.JSX.Element {
  const navigate = useNavigation((s) => s.navigate)

  useEffect(() => {
    const sort = useSortSession.getState()
    const compact = scene !== 'assistant'

    if (compact) void settingsApi.set({ sidebarCollapsed: true })

    switch (scene) {
      case 'approval':
        navigate('ask')
        window.setTimeout(() => {
          void useAgent.getState().run('put dentist in my calendar tomorrow at 4')
        }, 700)
        break
      case 'sort':
        navigate('sort')
        sort.setSourceFolder('/Users/you/Downloads')
        sort.setOutputFolder('/Users/you/Documents')
        sort.setClassified(DEMO_CLASSIFIED)
        sort.setStatus('previewing')
        break
      case 'history':
        navigate('history')
        break
      case 'watch':
        navigate('watch')
        break
      case 'suggestions':
      case 'assistant':
      default:
        navigate('ask')
    }
  }, [scene, navigate])

  return (
    <>
      <AppShell>
        <DemoRoutes />
      </AppShell>
      <Toaster position="bottom-center" />
    </>
  )
}
