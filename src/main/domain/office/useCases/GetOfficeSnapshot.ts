import type { OfficeSnapshot } from '../../../../shared/office'
import type { Bot, BotSignal } from '../model'
import type { RosterRepo } from '../repository/RosterRepo'
import type { SignalRepo } from '../repository/SignalRepo'
import type { SecretStore } from '../../../infrastructure/office/SecretStore'
import type { FunnelStatus } from '../../../infrastructure/office/FunnelControl'
import { layoutRooms } from '../layoutRooms'
import { placeBot } from '../placeBot'

const FEED_LINES = 20
// ponytail: placement reads one week of signals; a bot quiet for longer shows in chill
// without the stale flag. Store a per-bot "last signal" if that ever matters.
const HISTORY_MS = 7 * 24 * 60 * 60_000

export interface GetOfficeSnapshotDeps {
  roster: Pick<
    RosterRepo,
    'getProject' | 'listProjects' | 'listGroups' | 'listBots' | 'listRooms' | 'allBots'
  >
  signals: Pick<SignalRepo, 'recent' | 'latestFeed'>
  secrets: Pick<SecretStore, 'get'>
  staleMinutes: () => number
  t3Connected: () => boolean
  funnel: () => FunnelStatus
  now: () => Date
}

export class GetOfficeSnapshot {
  constructor(private readonly deps: GetOfficeSnapshotDeps) {}

  execute(projectId: string): OfficeSnapshot {
    const { roster, signals } = this.deps
    const project = roster.getProject(projectId)
    const rooms = roster.listRooms(projectId)
    const bots = roster.listBots(projectId)
    const botIds = bots.map((b) => b.id)
    const now = this.deps.now()
    const history = signals.recent(botIds, new Date(now.getTime() - HISTORY_MS).toISOString())
    const staleMinutes = this.deps.staleMinutes()
    const boxes = new Map(layoutRooms(rooms).map((b) => [b.roomId, b]))

    return {
      project,
      projects: roster.listProjects(),
      rooms: rooms.flatMap((r) => {
        const box = boxes.get(r.id)
        return box ? [{ ...r, ...box }] : []
      }),
      bots: bots.map((bot) => ({
        ...bot,
        placement: placeBot({
          bot,
          rooms,
          signals: history.filter((s) => s.botId === bot.id),
          now,
          staleMinutes
        }),
        webhookReady: this.webhookReady(bot)
      })),
      groups: roster.listGroups(projectId),
      feed: this.feed(botIds),
      t3Connected: this.deps.t3Connected(),
      funnel: this.deps.funnel()
    }
  }

  private webhookReady(bot: Bot): boolean {
    return bot.webhookUrl !== null && this.deps.secrets.get(`webhook-key:${bot.id}`) !== null
  }

  private feed(botIds: string[]): OfficeSnapshot['feed'] {
    const names = new Map(this.deps.roster.allBots().map((b) => [b.id, b.name]))
    return this.deps.signals.latestFeed(botIds, FEED_LINES).flatMap((s) => {
      const text = feedText(s, (id) => names.get(id) ?? id)
      return text ? [{ botId: s.botId, text, at: s.at }] : []
    })
  }
}

function feedText(s: BotSignal, nameOf: (botId: string) => string): string | null {
  switch (s.kind) {
    case 'chat':
      return s.text
    case 'task':
      return `Started: ${s.task}`
    case 'result':
      return `Done: ${s.text}`
    case 'task-failed':
      return `Task failed: ${s.reason}`
    case 'message':
      return `→ ${nameOf(s.toBotId)}: ${s.text}`
    case 't3':
      if (s.status === 'running') return `T3: ${s.title}`
      if (s.status === 'waiting') return `Waiting for you in T3: ${s.title}`
      return `Finished in T3: ${s.title}`
    case 'idle':
      return null
  }
}
