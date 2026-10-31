import type { RosterRepo } from '../repository/RosterRepo'
import { botInstructions } from '../botInstructions'
import { UnknownBotError } from '../errors'

const FUNNEL_OFF_URL = '<turn on Funnel to get the URL>'

export class GetBotInstructions {
  constructor(
    private readonly deps: {
      roster: Pick<RosterRepo, 'allBots' | 'listGroups'>
      funnelUrl: () => string | null
    }
  ) {}

  execute({ botId }: { botId: string }): string {
    const bot = this.deps.roster.allBots().find((b) => b.id === botId)
    if (!bot) throw new UnknownBotError(botId)
    const base = this.deps.funnelUrl()
    return botInstructions({
      bot,
      groups: this.deps.roster.listGroups(bot.projectId),
      eventsUrl: base ? `${base}/events` : FUNNEL_OFF_URL
    })
  }
}
