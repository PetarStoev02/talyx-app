import { useEffect, useState } from 'react'
import { Toaster } from 'sonner'
import { ErrorBoundary } from '@app/ErrorBoundary'
import { AppShell, ModuleSidebar } from '@widgets/app-shell'
import { useNavigation } from '@app/providers/useNavigation'
import { useRosterBackend } from '@app/providers/useRosterBackend'
import { useChatBackend } from '@app/providers/useChatBackend'
import { useProvidersBackend } from '@app/providers/useProvidersBackend'
import { useSetupBackend } from '@app/providers/useSetupBackend'
import { useFirstSetupStep } from '@app/providers/useFirstSetupStep'
import { useTheme } from '@shared/hooks/useTheme'
import { useKeyboardShortcuts } from '@shared/hooks/useKeyboardShortcuts'
import { reportError } from '@shared/lib/report'
import { AgentsPage } from '@pages/agents'
import { SettingsPage } from '@pages/settings'
import { ModulePage } from '@pages/module'
import { ActivationDialog } from '@widgets/modules'
import { TooltipProvider } from '@shared/ui/tooltip'
import { Roster, RosterAdd, RosterRefresh } from '@widgets/roster'
import { ConnectionBanner, EngineSplash } from '@widgets/engine-gate'
import { SetupFlow } from '@widgets/setup'
import { ProvidersSection } from '@widgets/providers'
import { MANAGER } from '@features/bots/details'
import { useRoster } from '@features/bots/store'
import { setupVisibility } from '@features/setup/steps'
import { useSetup } from '@features/setup/store'
import { useEngine } from '@app/providers/useEngine'
import { moduleIdOf, runningModules, useModules } from '@features/modules/store'
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
  const setup = useSetupBackend()
  const engineKnown = useEngine((s) => s.status !== null)
  const setupDone = useSetup((s) => s.setupDone)
  const forced = useSetup((s) => s.forced)
  const firstSetupStep = useFirstSetupStep(providers)
  const visibility = setupVisibility(setupDone, firstSetupStep)
  // Once shown, setup stays until its Done, even when a step it ran completes everything.
  const [inSetup, setInSetup] = useState(false)
  if ((visibility === 'show' || forced) && !inSetup) setInSetup(true)
  const modules = runningModules(useModules((s) => s.state))
  const openModule = modules.find((module) => module.id === moduleIdOf(currentView))
  const page =
    currentView === 'settings' ? (
      <SettingsPage providers={providers} chat={chat} />
    ) : openModule ? (
      <ModulePage module={openModule} />
    ) : (
      // Also a module page whose module stopped or was removed: back to the agents.
      <AgentsPage chat={chat} roster={rosterBackend} />
    )

  // A module page whose module stopped, expired or was removed hands back to the agents, so a
  // later key does not jump straight to it.
  useEffect(() => {
    if (moduleIdOf(currentView) && !openModule) navigate('agents')
  }, [currentView, openModule, navigate])

  useEffect(() => {
    useSetup
      .getState()
      .load()
      .catch((error: unknown) => {
        reportError('setup', error)
        // Unreadable settings must not hold the splash; the engine gate still covers a missing engine.
        useSetup.setState({ setupDone: true })
      })
  }, [])

  // Everything was already done (an existing setup): setup counts as finished without showing.
  useEffect(() => {
    if (visibility === 'hidden' && setupDone === false && !inSetup)
      useSetup
        .getState()
        .finish()
        .catch((error: unknown) => reportError('setup', error))
  }, [visibility, setupDone, inSetup])

  function finishSetup(): void {
    // The app opens on Talyx's chat once setup is done.
    useRoster.getState().select({ kind: 'bot', id: MANAGER })
    navigate('agents')
    useSetup
      .getState()
      .finish()
      .catch((error: unknown) => {
        reportError('setup', error)
        // Unsaved, setup shows again at the next launch; this session goes on to the app.
        useSetup.setState({ setupDone: true, forced: false })
      })
      // Only once setupDone is true, or the flow would open again at Welcome.
      .finally(() => setInSetup(false))
  }

  if (!engineKnown || (visibility === 'loading' && !inSetup)) return <EngineSplash />

  const roster = rosterBackend && (
    <ErrorBoundary scope="roster">
      <Roster
        backend={rosterBackend}
        models={chat?.models ?? null}
        onSelect={() => navigate('agents')}
      />
    </ErrorBoundary>
  )

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
      <ActivationDialog />
      {inSetup ? (
        <SetupFlow
          providersForm={
            providers &&
            ((onOverview) => (
              <ProvidersSection backend={providers} chat={chat} onOverview={onOverview} />
            ))
          }
          roster={rosterBackend}
          chat={chat}
          setup={setup}
          onDone={finishSetup}
        />
      ) : (
        <AppShell
          titleEnd={rosterBackend && <RosterAdd />}
          footerEnd={rosterBackend && <RosterRefresh backend={rosterBackend} />}
          roster={roster}
          sidebar={openModule && <ModuleSidebar module={openModule} roster={roster} />}
        >
          <ConnectionBanner />
          {/* A page you switch to fades in; the one you left is gone at once. */}
          <main key={currentView} className="animate-arrive min-h-0 flex-1 overflow-hidden">
            <ErrorBoundary scope={currentView}>{page}</ErrorBoundary>
          </main>
        </AppShell>
      )}
    </TooltipProvider>
  )
}

export default App
