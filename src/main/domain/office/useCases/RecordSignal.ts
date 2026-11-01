import type { BotSignal } from '../model'
import type { SignalRepo } from '../repository/SignalRepo'
import type { RosterRepo } from '../repository/RosterRepo'
import { UnknownBotError } from '../errors'

export interface RecordSignalDeps {
  signals: SignalRepo
  roster: RosterRepo
  onChange: (projectId: string) => void
}

export class RecordSignal {
  constructor(private readonly deps: RecordSignalDeps) {}

  execute(signal: BotSignal): void {
    const bot = this.deps.roster.allBots().find((b) => b.id === signal.botId)
    if (!bot) throw new UnknownBotError(signal.botId)
    if (this.isDuplicateMessage(signal)) return
    this.deps.signals.append(signal)
    this.deps.onChange(bot.projectId)
  }

  private isDuplicateMessage(signal: BotSignal): boolean {
    if (signal.kind !== 'chat' && signal.kind !== 'dm') return false
    if (signal.author !== 'owner' || signal.messageId === null) return false
    return this.deps.signals.hasOwnerMessageId(signal.messageId)
  }
}
