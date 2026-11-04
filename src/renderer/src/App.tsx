import { Toaster } from 'sonner'
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
import { Roster } from '@widgets/roster'
import { EngineSplash } from '@widgets/engine-gate'
import { useEngine } from '@app/providers/useEngine'

function App(): React.JSX.Element {
  useKeyboardShortcuts()
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
      <Toaster position="bottom-right" richColors closeButton theme={effectiveTheme} />
      <AppShell
        roster={
          rosterBackend && (
            <Roster
              backend={rosterBackend}
              models={chat?.models ?? null}
              onSelect={() => navigate('agents')}
            />
          )
        }
      >
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
