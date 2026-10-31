import { webhookKeyName, type Bot, type BotSignal } from '../model'
import type { RosterRepo } from '../repository/RosterRepo'
import type { SignalRepo } from '../repository/SignalRepo'
import type { RecordSignal } from './RecordSignal'
import type { SecretStore } from '../../../infrastructure/office/SecretStore'
import type { WebhookClient } from '../../../infrastructure/office/WebhookClient'
import { BotNotReachableError, InvalidEventError } from '../errors'
import { failureReason } from './GiveTask'

const MAX_MESSAGE_CHARS = 4000

export interface OwnerMessageDeps {
  roster: Pick<RosterRepo, 'allBots' | 'listProjects' | 'listGroups'>
  secrets: Pick<SecretStore, 'get'>
  webhook: WebhookClient
  record: Pick<RecordSignal, 'execute'>
  signals: Pick<SignalRepo, 'botTimeline'>
  newMessageId: () => string
  now: () => Date
}

/** Shared by the group and direct message use cases: validate, store the owner's message, hand it to a bot. */
export abstract class OwnerMessageSender {
  constructor(protected readonly deps: OwnerMessageDeps) {}

  protected cleanText(raw: string): string {
    const text = raw.trim().slice(0, MAX_MESSAGE_CHARS)
    if (!text) throw new InvalidEventError('text', 'must not be empty')
    return text
  }

  protected webhookOf(bot: Bot): { url: string; key: string } {
    const key = this.deps.secrets.get(webhookKeyName(bot.id))
    if (!bot.webhookUrl || !key) throw new BotNotReachableError(bot.id)
    return { url: bot.webhookUrl, key }
  }

  /** The owner's message stays in the conversation even when the routine call fails. */
  protected async deliver(
    hook: { url: string; key: string },
    ownerMessage: BotSignal,
    messageId: string,
    body: Record<string, unknown>
  ): Promise<void> {
    this.deps.record.execute(ownerMessage)
    try {
      await this.deps.webhook.trigger(hook.url, hook.key, body)
    } catch (e) {
      this.deps.record.execute({
        kind: 'task-failed',
        botId: ownerMessage.botId,
        runId: messageId,
        reason: failureReason(e),
        at: this.at()
      })
      throw e
    }
  }

  protected at(): string {
    return this.deps.now().toISOString()
  }
}
