import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import { SidebarFooter } from '../../../src/renderer/src/widgets/app-shell/SidebarFooter'
import { Roster } from '../../../src/renderer/src/widgets/roster/Roster'
import { RosterAdd } from '../../../src/renderer/src/widgets/roster/RosterAdd'
import { RosterRefresh } from '../../../src/renderer/src/widgets/roster/RosterRefresh'
import { AgentsPage } from '../../../src/renderer/src/pages/agents/AgentsPage'
import { ProvidersSection } from '../../../src/renderer/src/widgets/providers'
import { SetupFlow } from '../../../src/renderer/src/widgets/setup'
import { MANAGER } from '../../../src/renderer/src/features/bots/details'
import { useRoster } from '../../../src/renderer/src/features/bots/store'
import { reportProvider, useSetup } from '../../../src/renderer/src/features/setup/store'
import { useNavigation } from '../../../src/renderer/src/app/providers/useNavigation'
import { assets, attachDouble, chat, providers, rosterBackend } from './engineDouble'
import { fixtureSetup, setupMode, setupOutside, setupStuck } from './fixtureSetup'
import { fixtureUpdates, updateMode, updateNeedsOlderEngine } from './fixtureUpdates'
import type { EngineApiRequest } from '../../../src/renderer/src/shared/engine/http'
import './fixture.css'

attachDouble()
// `?setup=<mode>` opens the setup flow first, against a scripted install; it replaces the engine.
// `?update=engine|both` is `old-after` too: an engine below the pin whose update the footer offers.
const update = updateMode(location.search)
const mode = setupMode(location.search) ?? (updateNeedsOlderEngine(update) ? 'old-after' : null)
const setup =
  mode &&
  fixtureSetup(mode, {
    stuck: setupStuck(location.search),
    outside: setupOutside(location.search)
  })
// `old-after`: setup is done; the Agents page's engine gate runs its update through `window.api`.
// `?update=<mode>` scripts the Talyx update the footer button offers; without it nothing is pending.
Object.assign(window, {
  api: {
    ...(setup &&
      mode === 'old-after' && {
        getInstallSteps: setup.installSteps,
        runInstall: setup.run,
        cancelInstall: setup.cancel,
        onInstallOutput: setup.onOutput,
        onInstallExit: setup.onExit
      }),
    ...fixtureUpdates(update)
  }
})
// `?nudge`: no provider read yet, so Talyx's chat asks for one until Settings reads the endpoint.
if (new URLSearchParams(location.search).has('nudge')) useSetup.getState().setHasProvider(false)

// `&provider=elsewhere`: setup's provider step starts with no provider; one is added in "another
// window" once this one loses focus, so the step finds it when the window gets focus again.
const providerElsewhere = new URLSearchParams(location.search).get('provider') === 'elsewhere'
let providerAdded = !providerElsewhere
window.addEventListener('blur', () => (providerAdded = true), { once: true })
const setupProviders: typeof providers = {
  ...providers,
  http: async <T,>(request: EngineApiRequest): Promise<T> => {
    const answer = await providers.http<T>(request)
    if (providerAdded || request.method) return answer
    if (request.path.startsWith('/api/providers/custom-endpoints?'))
      return { ...answer, endpoints: [] } as T
    if (request.path.startsWith('/api/providers/oauth?')) {
      const { providers: accounts } = answer as { providers: Array<{ status: object }> }
      const signedOut = accounts.map((account) => ({ ...account, status: { logged_in: false } }))
      return { providers: signedOut } as T
    }
    return answer
  }
}

// The newest exported avatar image, so the PNG can be checked without an engine.
function ExportedAvatar(): React.JSX.Element | null {
  const [latest, setLatest] = useState<[string, string] | null>(null)
  useEffect(() => {
    const show = (): void => setLatest(Object.entries(assets).at(-1) ?? null)
    window.addEventListener('fixture-asset', show)
    return () => window.removeEventListener('fixture-asset', show)
  }, [])
  if (!latest) return null
  return (
    <figure className="mx-3 flex items-center gap-2 text-xs">
      <img src={latest[1]} alt="" width={48} height={48} data-testid="exported-avatar" />
      <figcaption>Exported avatar.png for {latest[0]}</figcaption>
    </figure>
  )
}

// The setup flow until its Done, then the fixture with Talyx's chat open, as the app does.
function Root(): React.JSX.Element {
  const [inSetup, setInSetup] = useState(setup !== null && mode !== 'old-after')
  if (!setup || !inSetup) return <Fixture />
  return (
    <div className="h-screen bg-background">
      <Toaster position="bottom-right" closeButton />
      <SetupFlow
        providersForm={(onOverview) => (
          <ProvidersSection
            backend={setupProviders}
            roster={rosterBackend}
            chat={chat}
            onOverview={onOverview}
          />
        )}
        roster={rosterBackend}
        chat={chat}
        setup={setup}
        onDone={() => {
          useRoster.getState().select({ kind: 'bot', id: MANAGER })
          setInSetup(false)
        }}
      />
    </div>
  )
}

export function Fixture(): React.JSX.Element {
  // The app's navigation store, so the chat's "Open Settings" works here too.
  const page = useNavigation((state) => state.currentView)
  const navigate = useNavigation((state) => state.navigate)
  const online = useRoster((state) => state.online)
  return (
    <div className="flex h-screen bg-background">
      <Toaster position="bottom-right" closeButton />
      <aside className="tone-step flex w-[320px] max-w-[85vw] shrink-0 flex-col">
        {/* The app puts the roster's `+` at the end of the sidebar's title row. */}
        <div className="flex items-center justify-between px-5 pt-4 pr-3">
          <h1 className="text-xl font-semibold">Talyx</h1>
          <RosterAdd />
        </div>
        <span className="px-5 text-xs">Interaction fixture · synthetic data</span>
        <Roster backend={rosterBackend} models={chat.models} onSelect={() => navigate('agents')} />
        <button
          className="m-3 rounded-full px-3 py-2 text-left text-sm hover:bg-accent"
          aria-pressed={page === 'settings'}
          onClick={() => navigate(page === 'settings' ? 'agents' : 'settings')}
        >
          {page === 'settings' ? 'Back to agents' : 'Settings'}
        </button>
        <button
          className="mx-3 mb-3 rounded-full px-3 py-2 text-left text-sm hover:bg-accent"
          aria-pressed={!online}
          onClick={() => useRoster.getState().setOnline(!online)}
        >
          {online ? 'Drop the engine socket (offline)' : 'Reconnect the engine socket'}
        </button>
        <ExportedAvatar />
        {/* The app's footer row: its update button takes the refresh button's place. */}
        <SidebarFooter end={<RosterRefresh backend={rosterBackend} />} />
      </aside>
      <main className="min-w-0 flex-1">
        {page === 'settings' ? (
          // The settings page's own sections, without Appearance: it needs the desktop bridge.
          <div className="mx-auto w-full max-w-2xl space-y-4 overflow-y-auto p-6">
            <ProvidersSection
              backend={providers}
              roster={rosterBackend}
              chat={chat}
              onOverview={reportProvider}
            />
          </div>
        ) : (
          <AgentsPage chat={chat} roster={rosterBackend} />
        )}
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Root />)
