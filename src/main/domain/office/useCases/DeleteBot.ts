import { webhookKeyName } from '../model'
import type { RosterRepo } from '../repository/RosterRepo'

export class DeleteBot {
  constructor(
    private readonly deps: {
      roster: Pick<RosterRepo, 'deleteBot'>
      secrets: { delete(name: string): void }
    }
  ) {}

  execute(botId: string): void {
    this.deps.roster.deleteBot(botId)
    this.deps.secrets.delete(webhookKeyName(botId))
  }
}
