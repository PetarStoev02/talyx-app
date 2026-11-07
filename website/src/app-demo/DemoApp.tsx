import { useEffect } from 'react'
import { Toaster } from 'sonner'
import { AppShell } from '@widgets/app-shell'
import { AgentsPage } from '@pages/agents'
import { Roster, RosterAdd, RosterRefresh } from '@widgets/roster'
import { TooltipProvider } from '@shared/ui/tooltip'
import { MANAGER } from '@features/bots/details'
import { useRoster } from '@features/bots/store'
import { attachDouble, chat, rosterBackend } from '../../../tests/fixtures/roster/engineDouble'

export type DemoView = 'chat' | 'cards' | 'details' | 'room'

// Before the first render: the Agents page checks for an engine when it has none.
attachDouble()

function showScene(scene: DemoView) {
  const { select, editProfile } = useRoster.getState()
  if (scene === 'room') return select({ kind: 'room', id: 'team-room' })
  if (scene === 'cards') return select({ kind: 'bot', id: 'developer' })
  select({ kind: 'bot', id: scene === 'details' ? 'analyst' : MANAGER })
  if (scene === 'details') editProfile('analyst')
}

/** The real app shell on the roster fixture's in-memory engine, opened on a landing-page scene. */
export function DemoApp({ scene }: { scene: DemoView }) {
  useEffect(() => showScene(scene), [scene])

  return (
    <TooltipProvider>
      <AppShell
        titleEnd={<RosterAdd />}
        footerEnd={<RosterRefresh backend={rosterBackend} />}
        roster={<Roster backend={rosterBackend} models={chat.models} onSelect={() => {}} />}
      >
        <main className="min-h-0 flex-1 overflow-hidden">
          <AgentsPage chat={chat} roster={rosterBackend} />
        </main>
      </AppShell>
      <Toaster position="top-right" closeButton />
    </TooltipProvider>
  )
}
