import { Toaster } from 'sonner'
import { ErrorBoundary } from '@app/ErrorBoundary'
import { AppShell } from '@widgets/app-shell'
import { useNavigation } from '@app/providers/useNavigation'
import { useRosterBackend } from '@app/providers/useRosterBackend'
import { useChatBackend } from '@app/providers/useChatBackend'
import { useProvidersBackend } from '@app/providers/useProvidersBackend'
import { useTheme } from '@shared/hooks/useTheme'
import { useKeyboardShortcuts } from '@shared/hooks/useKeyboardShortcuts'
import { AgentsPage } from '@pages/agents'
import { SettingsPage } from '@pages/settings'
import { EngineDebugPage } from '@pages/engine-debug'
import { TooltipProvider } from '@shared/ui/tooltip'
import { Roster, RosterAdd, RosterRefresh } from '@widgets/roster'
import { ConnectionBanner, EngineSplash } from '@widgets/engine-gate'
import { useEngine } from '@app/providers/useEngine'
import { useSelectionMemory } from '@app/providers/useSelectionMemory'

function App(): React.JSX.Element {
  useKeyboardShortcuts()
  useSelectionMemory()
  const { effectiveTheme } = useTheme()
  const currentView = useNavigation((s) => s.currentView)
  const navigate = useNavigation((s) => s.navigate)
  const rosterBackend = useRosterBackend()
  // Here, not in the page: replies keep marking bots unread while another page is open.
  const chat = useChatBackend()
  const providers = useProvidersBackend()
  const engineKnown = useEngine((s) => s.status !== null)
  const pages = {
    agents: <AgentsPage chat={chat} roster={rosterBackend} />,
    'engine-debug': <EngineDebugPage />,
    settings: <SettingsPage providers={providers} models={chat?.models ?? null} />
  }

  if (!engineKnown) return <EngineSplash />

  return (
    <TooltipProvider>
      <Toaster
        // Top right: at the bottom, toasts cover the composer's Send and Stop.
        position="top-right"
        closeButton
        // Errors wait to be dismissed; the rest go after 6 s, and hovering keeps any one open.
        duration={6000}
        theme={effectiveTheme}
        // Important: sonner's own border rule sits outside the CSS layers, so a layered utility loses.
        toastOptions={{ className: 'border-0!' }}
      />
      <AppShell
        titleEnd={rosterBackend && <RosterAdd />}
        footerEnd={rosterBackend && <RosterRefresh backend={rosterBackend} />}
        roster={
          rosterBackend && (
            <ErrorBoundary scope="roster">
              <Roster
                backend={rosterBackend}
                models={chat?.models ?? null}
                onSelect={() => navigate('agents')}
              />
            </ErrorBoundary>
          )
        }
      >
        <ConnectionBanner />
        {/* A page you switch to fades in; the one you left is gone at once. */}
        <main key={currentView} className="animate-arrive min-h-0 flex-1 overflow-hidden">
          <ErrorBoundary scope={currentView}>{pages[currentView]}</ErrorBoundary>
        </main>
      </AppShell>
    </TooltipProvider>
  )
}

export default App
