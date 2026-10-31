import type { Bot } from './model'
import type { RosterRepo } from './repository/RosterRepo'

const PROJECT_ID = 'agro-ops'
const TEAM = 'agro-ops-team'
const CLIENTS = 'agro-ops-clients'
const RELAYS: Record<string, string> = {
  [TEAM]: 'agro-ops-cto',
  [CLIENTS]: 'agro-ops-grok-bot'
}
const T3_TOTS_PROJECTS = [
  '879420be-6729-4458-bdc3-6f171b6d09bf', // agro-ops-platform
  '7aea81f8-3067-4355-96ea-da6871d2e11b' // agro-ops-agents
]

type Seed = [slug: string, name: string, color: string, groupIds: string[]]

const BOTS: Seed[] = [
  ['cto', 'CTO', '#9a9a9a', [TEAM]],
  ['sales', 'Sales', '#e84a9a', [TEAM]],
  ['product-lead', 'Product Lead', '#8b5cf6', [TEAM]],
  ['cfo', 'CFO', '#e5484d', [TEAM]],
  ['t3-tots', 'T3 Tots', '#22d3ee', [TEAM]],
  ['grok-bot', 'Grok Bot', '#e5e7eb', [TEAM, CLIENTS]],
  ['coop-manager', 'Co-op Manager', '#e5484d', [CLIENTS]],
  ['small-farm', 'Small Farm', '#4fb8a5', [CLIENTS]],
  ['mid-size-farm', 'Mid-size Farm', '#e5484d', [CLIENTS]],
  ['agronomist', 'Agronomist', '#e8963a', [CLIENTS]],
  ['dealer-agronomist', 'Dealer Agronomist', '#ec5fa0', [CLIENTS]]
]

/** Re-runnable: inserts AgroOps once, then only fills relays still missing. */
export function seedAgroOps(repo: RosterRepo): void {
  if (repo.listProjects().some((p) => p.id === PROJECT_ID)) return fillMissingRelays(repo)
  // One transaction: the guard above is the project row, so a partial seed must never persist.
  repo.transaction(() => insertAgroOps(repo))
}

function fillMissingRelays(repo: RosterRepo): void {
  for (const g of repo.listGroups(PROJECT_ID)) {
    const relay = RELAYS[g.id]
    if (g.relayBotId === null && relay) repo.saveGroup({ ...g, relayBotId: relay })
  }
}

function insertAgroOps(repo: RosterRepo): void {
  repo.saveProject({ id: PROJECT_ID, name: 'AgroOps', logoPath: null, windowView: 'none' })
  repo.saveGroup({
    id: TEAM,
    projectId: PROJECT_ID,
    name: 'Agro Ops team',
    relayBotId: RELAYS[TEAM]
  })
  repo.saveGroup({
    id: CLIENTS,
    projectId: PROJECT_ID,
    name: 'Agro Ops client panel',
    relayBotId: RELAYS[CLIENTS]
  })
  const rooms = [
    ['agro-ops-team-room', 'Team conference', 'conference', TEAM],
    ['agro-ops-client-room', 'Client conference', 'conference', CLIENTS],
    ['agro-ops-work', 'Work room', 'work', null],
    ['agro-ops-chill', 'Chill room', 'chill', null]
  ] as const
  for (const [id, name, kind, groupId] of rooms) {
    repo.saveRoom({ id, projectId: PROJECT_ID, name, kind, groupId })
  }
  for (const [slug, name, color, groupIds] of BOTS) {
    const bot: Bot = {
      id: `agro-ops-${slug}`,
      projectId: PROJECT_ID,
      name,
      color,
      groupIds,
      webhookUrl: null,
      t3ProjectIds: slug === 't3-tots' ? T3_TOTS_PROJECTS : [],
      grokLink: null
    }
    repo.saveBot(bot)
  }
}
