import { useEffect, useRef, useState } from 'react'
import { Toaster } from 'sonner'
import { AppShell } from '@widgets/app-shell'
import { useNavigation } from '@app/providers/useNavigation'
import { useSortSession } from '@app/providers/useSortSession'
import { useLanguage } from '@app/providers/useLanguage'
import { useTheme } from '@shared/hooks/useTheme'
import { useKeyboardShortcuts } from '@shared/hooks/useKeyboardShortcuts'
import { appApi, settingsApi } from '@shared/api/ipc'
import { WelcomeOverlay } from '@widgets/welcome'
import { TourOverlay } from '@widgets/tour'
import { useTour } from '@app/providers/useTour'
import { useAgent } from '@features/assistant/useAgent'
import { AskPage } from '@pages/ask'
import { SortPage } from '@pages/sort'
import { WatchPage } from '@pages/watch'
import { HistoryPage } from '@pages/history'
import { SettingsPage } from '@pages/settings'
import { SearchPage } from '@pages/search'
import { TooltipProvider } from '@shared/ui/tooltip'

function App(): React.JSX.Element {
  useKeyboardShortcuts()
  const { effectiveTheme } = useTheme()
  const currentView = useNavigation((s) => s.currentView)
  const [showWelcome, setShowWelcome] = useState(false)
  const [tourPending, setTourPending] = useState(false)

  const setLanguage = useLanguage((s) => s.setLanguage)

  useEffect(() => {
    settingsApi.get().then((s) => {
      if (!s.hasSeenOnboarding) setShowWelcome(true)
      if (!s.hasSeenTour) setTourPending(true)
      if (s.appLanguage) setLanguage(s.appLanguage)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const startTour = useTour((s) => s.start)
  // A ref guard (not state) marks the tour as launched: launching is a one-shot
  // side effect on an external store, not something the component needs to
  // re-render for, so there's no setState to run synchronously in this effect.
  const tourStartedRef = useRef(false)
  useEffect(() => {
    if (tourStartedRef.current) return
    if (tourPending && !showWelcome) {
      tourStartedRef.current = true
      startTour()
    }
  }, [tourPending, showWelcome, startTour])

  const navigate = useNavigation((s) => s.navigate)
  const subscribeAgent = useAgent((s) => s.subscribe)
  const agentPhase = useAgent((s) => s.phase)

  // Subscribed for the window's whole life, not just while Ask is mounted: an
  // approval raised while the owner is on another page has to reach them.
  useEffect(() => subscribeAgent(), [subscribeAgent])
  useEffect(() => {
    if (agentPhase === 'approval') navigate('ask')
  }, [agentPhase, navigate])
  const setSourceFolder = useSortSession((s) => s.setSourceFolder)
  const setStatus = useSortSession((s) => s.setStatus)
  const setClassified = useSortSession((s) => s.setClassified)
  const setFiles = useSortSession((s) => s.setFiles)
  const setError = useSortSession((s) => s.setError)
  const setOutputFolder = useSortSession((s) => s.setOutputFolder)
  const setMode = useSortSession((s) => s.setMode)

  useEffect(() => {
    const cleanup = appApi.onOpenFolderForSort((folderPath) => {
      // Reset sort state and navigate to sort page with folder pre-loaded
      setClassified([])
      setFiles([])
      setStatus('idle')
      setError(null)
      // Mirror the browse/drop path: sort in place, so output = source
      setSourceFolder(folderPath)
      setOutputFolder(folderPath)
      setMode('move')
      navigate('sort')
    })
    return cleanup
  }, [
    navigate,
    setSourceFolder,
    setOutputFolder,
    setMode,
    setStatus,
    setClassified,
    setFiles,
    setError
  ])

  // Listen for navigation requests from Quick Search overlay
  useEffect(() => {
    const cleanup = appApi.onNavigate((view) => {
      navigate(view as 'sort' | 'watch' | 'history' | 'search' | 'settings')
    })
    return cleanup
  }, [navigate])

  const pages = {
    ask: <AskPage />,
    sort: <SortPage />,
    watch: <WatchPage />,
    history: <HistoryPage />,
    search: <SearchPage />,
    settings: <SettingsPage />
  }

  return (
    <TooltipProvider>
      {/* No bg here — the body paints the ambient glow that glass panels blur */}
      {showWelcome && <WelcomeOverlay onDismiss={() => setShowWelcome(false)} />}
      <TourOverlay />
      <Toaster position="bottom-right" richColors closeButton theme={effectiveTheme} />
      <AppShell>
        <main
          key={currentView}
          className="min-h-0 flex-1 overflow-hidden animate-in fade-in duration-200"
        >
          {pages[currentView]}
        </main>
      </AppShell>
    </TooltipProvider>
  )
}

export default App
