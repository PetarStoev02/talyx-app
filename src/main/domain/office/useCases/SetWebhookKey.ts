import { webhookKeyName } from '../model'
import type { RosterRepo } from '../repository/RosterRepo'
import { UnknownBotError } from '../errors'

export class SetWebhookKey {
  constructor(
    private readonly deps: {
      roster: Pick<RosterRepo, 'allBots'>
      secrets: { set(name: string, value: string): void }
    }
  ) {}

  execute({ botId, key }: { botId: string; key: string }): void {
    if (!this.deps.roster.allBots().some((b) => b.id === botId)) throw new UnknownBotError(botId)
    this.deps.secrets.set(webhookKeyName(botId), key)
  }
}
