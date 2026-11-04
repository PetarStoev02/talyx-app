import { createRoot } from 'react-dom/client'
import { Roster } from '../../../src/renderer/src/widgets/roster/Roster'
import { AgentsPage } from '../../../src/renderer/src/pages/agents/AgentsPage'
import { useRoster } from '../../../src/renderer/src/features/bots/store'
import { useEngine } from '../../../src/renderer/src/app/providers/useEngine'
import type { RosterRequest } from '../../../src/renderer/src/features/bots/data'
import { fixtureChat } from './fixtureChat'
import { roomRequest } from './fixtureRooms'
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
// Profile details and routines, also synthetic. paid-model stands in for a model the engine asks
// about before pinning.
const details: Record<
  string,
  { description: string; soul: string; provider: string; model: string }
> = Object.fromEntries(
  profiles.map(({ name }) => [
    name,
    {
      description: `Synthetic ${name} agent`,
      soul: `# ${name}\n\nYou are a synthetic fixture agent.`,
      provider: 'custom',
      model: '9-route-provider'
    }
  ])
)
const jobs: Record<string, Record<string, unknown>[]> = {
  analyst: [
    {
      job_id: 'cash',
      name: 'Monday cash position',
      schedule: '0 8 * * 1',
      deliver: 'bot-chat',
      enabled: true,
      state: 'scheduled'
    },
    {
      job_id: 'invoices',
      name: 'Invoice chase',
      schedule: '0 17 * * *',
      enabled: false,
      state: 'paused'
    }
  ]
}
let nextJob = 1

function configure(profile: string, params: Record<string, unknown>): unknown {
  const bot = profiles.find((bot) => bot.name === profile)!
  if (!params.ui_meta) {
    const state = details[profile]
    const applied: Record<string, boolean> = {}
    if (typeof params.description === 'string') {
      state.description = params.description
      applied.description = true
    }
    if (typeof params.soul === 'string') {
      state.soul = params.soul
      applied.soul = true
    }
    if (typeof params.model === 'string') {
      if (params.model === 'paid-model' && params.confirm_expensive_model !== true)
        return {
          ok: true,
          applied,
          confirm_required: true,
          confirm_message: 'paid-model costs more per turn.'
        }
      state.model = params.model
      state.provider = params.provider as string
      applied.model = true
    }
    return { ok: true, applied }
  }
  for (const [key, value] of Object.entries(params.ui_meta as Record<string, unknown>)) {
    bot.ui_meta[key] = value
    bot.ui_meta_revisions[key] = (bot.ui_meta_revisions[key] ?? 0) + 1
  }
  return { applied: { ui_meta: true } }
}

function manageCron(profile: string, params: Record<string, unknown>): unknown {
  const list = (jobs[profile] ??= [])
  const job = list.find((item) => item.job_id === params.name)
  if (params.action === 'list') return { success: true, jobs: structuredClone(list) }
  if (params.action === 'add') {
    list.push({
      job_id: `fixture-${nextJob++}`,
      name: params.name,
      schedule: params.schedule,
      deliver: params.deliver,
      enabled: true,
      state: 'scheduled'
    })
    return { success: true }
  }
  if (!job) return { success: false, error: 'Routine not found' }
  if (params.action === 'remove') list.splice(list.indexOf(job), 1)
  else {
    job.enabled = params.action === 'resume'
    job.state = params.action === 'resume' ? 'scheduled' : 'paused'
  }
  return { success: true }
}

function createProfile(params: Record<string, unknown>): unknown {
  const name = params.name as string
  if (profiles.some((bot) => bot.name === name)) throw new Error(`Profile '${name}' already exists`)
  profiles.push({
    name,
    ui_meta: {},
    ui_meta_revisions: {},
    last_session: { preview: '', last_active: 0 }
  })
  details[name] = {
    description: '',
    soul: params.soul as string,
    provider: (params.provider as string) ?? 'custom',
    model: (params.model as string) ?? '9-route-provider'
  }
  return { ok: true, name, path: `/fixture/${name}`, mirrored: {} }
}

const request: RosterRequest = async (profile, method, params) => {
  if (method === 'profiles.list')
    return {
      profiles: structuredClone(profiles).map((bot) => ({
        ...bot,
        description: details[bot.name]?.description ?? ''
      }))
    }
  if (method === 'profiles.describe') {
    const state = details[params.name as string]
    return {
      name: params.name,
      description: state.description,
      soul: state.soul,
      model: { provider: state.provider, default: state.model }
    }
  }
  if (method === 'profiles.configure') return configure(profile, params)
  if (method === 'profiles.create') return createProfile(params)
  if (method === 'cron.manage') return manageCron(profile, params)
  if (method.startsWith('groups.')) return roomRequest(method, params)
  throw new Error('Unsupported fixture operation')
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
    botGroupsMetaKey: 'acme-bots-groups',
    managerHandle: 'acme'
  }
})
useRoster.getState().setActivity('researcher', 'working')
useRoster.getState().setActivity('analyst', 'waiting')
useRoster.getState().markUnread('writer')
const chat = fixtureChat()
createRoot(document.getElementById('root')!).render(
  <div className="flex h-screen bg-card">
    <aside className="flex w-[320px] max-w-[85vw] shrink-0 flex-col bg-sidebar">
      <h1 className="px-5 pt-4 text-xl font-semibold">Talyx</h1>
      <span className="px-5 text-xs">Interaction fixture · synthetic data</span>
      <Roster backend={backend} models={chat.models} onSelect={() => undefined} />
    </aside>
    <main className="min-w-0 flex-1">
      <AgentsPage chat={chat} roster={backend} />
    </main>
  </div>
)
