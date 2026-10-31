import { OwnerMessageSender } from './OwnerMessageSender'
import { UnknownBotError } from '../errors'

const HISTORY_MESSAGES = 15
const OWNER_NAME = 'Petar'

export class SendDirectMessage extends OwnerMessageSender {
  async execute(input: { botId: string; text: string }): Promise<void> {
    const text = this.cleanText(input.text)
    const bot = this.deps.roster.allBots().find((b) => b.id === input.botId)
    if (!bot) throw new UnknownBotError(input.botId)
    const hook = this.webhookOf(bot)
    const history = this.deps.signals
      .botTimeline(bot.id, ['dm'], HISTORY_MESSAGES)
      .flatMap((s) =>
        s.kind === 'dm'
          ? [{ author: s.author === 'owner' ? OWNER_NAME : bot.name, text: s.text }]
          : []
      )
    const messageId = this.deps.newMessageId()
    await this.deliver(
      hook,
      { kind: 'dm', botId: bot.id, author: 'owner', text, messageId, at: this.at() },
      messageId,
      { message: text, messageId, target: 'dm', bot: bot.id, history }
    )
  }
}
