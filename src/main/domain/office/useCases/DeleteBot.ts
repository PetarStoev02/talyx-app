import { webhookKeyName } from '../model'
import type { RosterRepo } from '../repository/RosterRepo'
import type { SignalRepo } from '../repository/SignalRepo'

export class DeleteBot {
  constructor(
    private readonly deps: {
      roster: Pick<RosterRepo, 'deleteBot' | 'clearRelay'>
      signals: Pick<SignalRepo, 'deleteForBot'>
      secrets: { delete(name: string): void }
    }
  ) {}

  execute(botId: string): void {
    this.deps.roster.clearRelay(botId)
    this.deps.roster.deleteBot(botId)
    this.deps.signals.deleteForBot(botId)
    this.deps.secrets.delete(webhookKeyName(botId))
  }
}
