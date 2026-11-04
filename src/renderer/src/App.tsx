import { Toaster } from 'sonner'
import { AppShell } from '@widgets/app-shell'
import { useNavigation } from '@app/providers/useNavigation'
import { useTheme } from '@shared/hooks/useTheme'
import { useKeyboardShortcuts } from '@shared/hooks/useKeyboardShortcuts'
import { AgentsPage } from '@pages/agents'
import { SettingsPage } from '@pages/settings'
import { TooltipProvider } from '@shared/ui/tooltip'

const pages = {
  agents: <AgentsPage />,
  settings: <SettingsPage />
}

function App(): React.JSX.Element {
  useKeyboardShortcuts()
  const { effectiveTheme } = useTheme()
  const currentView = useNavigation((s) => s.currentView)

  return (
    <TooltipProvider>
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
