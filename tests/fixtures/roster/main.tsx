import { createRoot } from 'react-dom/client'
import { Roster } from '../../../src/renderer/src/widgets/roster/Roster'
import { AgentsPage } from '../../../src/renderer/src/pages/agents/AgentsPage'
import { useRoster } from '../../../src/renderer/src/features/bots/store'
import { useEngine } from '../../../src/renderer/src/app/providers/useEngine'
import type { RosterRequest } from '../../../src/renderer/src/features/bots/data'
import './fixture.css'

// Deliberately in-memory: this fixture never connects to or modifies user profiles.
const profiles = [
  'default',
  'researcher',
  'designer',
  'writer',
  'planner',
  'analyst',
  'reviewer',
  'developer',
  'support',
  'sales',
  'operations'
].map((name, index) => ({
  name,
  ui_meta: {
    'acme-bots': {
      title: name === 'default' ? 'Talyx' : name[0].toUpperCase() + name.slice(1),
      pinned: index < 2,
      pinnedOrder: index,
      sectionId: index < 6 ? 'team' : 'clients',
      sectionName: index < 6 ? 'Team' : 'Clients'
    }
  } as Record<string, unknown>,
  ui_meta_revisions: { 'acme-bots': 1 } as Record<string, number>,
  last_session: {
    preview: 'The latest work is ready to review.',
    last_active: Date.now() / 1000 - index * 120
  }
}))
const request: RosterRequest = async (profile, method, params) => {
  if (method === 'profiles.list') return { profiles: structuredClone(profiles) }
  if (method === 'groups.list')
    return {
      rooms: [
        {
          room_id: 'team-room',
          name: 'Team discussion',
          members: [{ profile: 'analyst' }, { profile: 'writer' }]
        },
        {
          room_id: 'clients-room',
          name: 'Clients discussion',
          members: [{ profile: 'support' }, { profile: 'sales' }]
        }
      ],
      next_offset: null
    }
  if (method !== 'profiles.configure') throw new Error('Unsupported fixture operation')
  const bot = profiles.find((bot) => bot.name === profile)!
  for (const [key, value] of Object.entries(params.ui_meta as Record<string, unknown>)) {
    bot.ui_meta[key] = value
    bot.ui_meta_revisions[key] = (bot.ui_meta_revisions[key] ?? 0) + 1
  }
  return { applied: { ui_meta: true } }
}
async function deleteProfile(profile: string): Promise<void> {
  if (profile === 'default') throw new Error('Cannot delete the default profile')
  const index = profiles.findIndex((bot) => bot.name === profile)
  if (index >= 0) profiles.splice(index, 1)
}
const backend = {
  request,
  deleteProfile,
  botMetaKey: 'acme-bots',
  botGroupsMetaKey: 'acme-bots-groups'
}
// The agents page waits for an attached engine; this page has no engine, so it says it has one.
useEngine.setState({
  status: {
    state: 'attached',
    version: 'fixture',
    commit: null,
    home: '',
    stale: false,
    botMetaKey: 'acme-bots',
    botGroupsMetaKey: 'acme-bots-groups'
  }
})
useRoster.getState().setActivity('researcher', 'working')
useRoster.getState().setActivity('analyst', 'waiting')
useRoster.getState().markUnread('writer')
createRoot(document.getElementById('root')!).render(
  <div className="flex h-screen bg-card">
    <aside className="flex w-[320px] max-w-[85vw] shrink-0 flex-col bg-sidebar">
      <h1 className="px-5 pt-4 text-xl font-semibold">Talyx</h1>
      <span className="px-5 text-xs">Interaction fixture · synthetic data</span>
      <Roster backend={backend} onSelect={() => undefined} />
    </aside>
    <main className="min-w-0 flex-1">
      <AgentsPage />
    </main>
  </div>
)
