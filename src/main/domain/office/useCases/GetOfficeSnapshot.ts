import type { OfficeSnapshot, T3Project } from '../../../../shared/office'
import { webhookKeyName, type Bot, type BotSignal, type Project } from '../model'
import type { RosterRepo } from '../repository/RosterRepo'
import type { SignalRepo } from '../repository/SignalRepo'
import { layoutRooms } from '../layoutRooms'
import { placeBot } from '../placeBot'
import { ProjectNotFoundError } from '../errors'
import { describeSignal } from '../describeSignal'

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
  secrets: { get(name: string): string | null }
  /** The project the user last chose; may point at a project that no longer exists. */
  currentProjectId: () => string | null
  staleMinutes: () => number
  t3Connected: () => boolean
  t3Projects: () => T3Project[]
  funnel: () => OfficeSnapshot['funnel']
  /** The stored logo as a data: URL, or null when it cannot be read. */
  logoDataUrl: (logoPath: string) => string | null
  now: () => Date
}

export class GetOfficeSnapshot {
  constructor(private readonly deps: GetOfficeSnapshotDeps) {}

  /** `null` means the current project: the saved choice if it still exists, else the first. */
  execute(requestedProjectId: string | null): OfficeSnapshot {
    const { roster, signals } = this.deps
    const projectId = requestedProjectId ?? this.currentProjectId()
    const project = roster.getProject(projectId)
    const rooms = roster.listRooms(projectId)
    const bots = roster.listBots(projectId)
    const botIds = bots.map((b) => b.id)
    const now = this.deps.now()
    const history = signals.recent(botIds, new Date(now.getTime() - HISTORY_MS).toISOString())
    const staleMinutes = this.deps.staleMinutes()
    const boxes = new Map(layoutRooms(rooms).map((b) => [b.roomId, b]))

    return {
      project: this.view(project),
      projects: roster.listProjects().map((p) => this.view(p)),
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
      t3Projects: this.deps.t3Projects(),
      funnel: this.deps.funnel()
    }
  }

  private currentProjectId(): string {
    const projects = this.deps.roster.listProjects()
    const saved = this.deps.currentProjectId()
    const project = projects.find((p) => p.id === saved) ?? projects[0]
    if (!project) throw new ProjectNotFoundError(saved ?? 'current')
    return project.id
  }

  private view(project: Project): OfficeSnapshot['project'] {
    return {
      ...project,
      logoDataUrl: project.logoPath ? this.deps.logoDataUrl(project.logoPath) : null
    }
  }

  private webhookReady(bot: Bot): boolean {
    return bot.webhookUrl !== null && this.deps.secrets.get(webhookKeyName(bot.id)) !== null
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
      if (s.text === null) return null
      return s.author === 'owner' ? `You: ${s.text}` : s.text
    case 'dm':
      return s.author === 'owner' ? `You → ${nameOf(s.botId)}: ${s.text}` : s.text
    default:
      return describeSignal(s, nameOf)
  }
}
