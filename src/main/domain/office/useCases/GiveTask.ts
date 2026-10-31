import { webhookKeyName, type Bot } from '../model'
import type { RosterRepo } from '../repository/RosterRepo'
import type { RecordSignal } from './RecordSignal'
import type { SecretStore } from '../../../infrastructure/office/SecretStore'
import type { T3Cli } from '../../../infrastructure/office/T3Cli'
import {
  InsecureWebhookUrlError,
  WebhookRejectedError,
  WebhookTimeoutError,
  type WebhookClient
} from '../../../infrastructure/office/WebhookClient'
import { BotNotReachableError, InvalidEventError, UnknownBotError } from '../errors'

const MAX_TASK_CHARS = 500
const THREAD_TITLE_CHARS = 60

export interface GiveTaskDeps {
  roster: Pick<RosterRepo, 'allBots'>
  secrets: Pick<SecretStore, 'get'>
  webhook: WebhookClient
  t3: Pick<T3Cli, 'startThread'>
  record: Pick<RecordSignal, 'execute'>
  eventsUrl: () => string | null
  newRunId: () => string
  now: () => Date
}

export type TaskTarget = { kind: 'webhook' } | { kind: 't3'; t3ProjectId: string }
export interface GiveTaskInput {
  botId: string
  task: string
  target: TaskTarget
}

export function failureReason(e: unknown): string {
  if (e instanceof WebhookRejectedError) return `http_${e.status}`
  if (e instanceof InsecureWebhookUrlError) return 'insecure_url'
  if (e instanceof WebhookTimeoutError) return 'timeout'
  return 'network'
}

export class GiveTask {
  constructor(private readonly deps: GiveTaskDeps) {}

  async execute(input: GiveTaskInput): Promise<void> {
    const bot = this.deps.roster.allBots().find((b) => b.id === input.botId)
    if (!bot) throw new UnknownBotError(input.botId)
    const task = input.task.trim().slice(0, MAX_TASK_CHARS)
    if (!task) throw new InvalidEventError('task', 'must not be empty')
    if (input.target.kind === 'webhook') await this.viaWebhook(bot, task)
    else await this.viaT3(bot, task, input.target.t3ProjectId)
  }

  private async viaWebhook(bot: Bot, task: string): Promise<void> {
    const key = this.deps.secrets.get(webhookKeyName(bot.id))
    if (!bot.webhookUrl || !key) throw new BotNotReachableError(bot.id)
    const runId = this.deps.newRunId()
    const base = this.deps.eventsUrl()
    const body = { task, runId, replyTo: base ? `${base}/events` : null, bot: bot.id }
    try {
      await this.deps.webhook.trigger(bot.webhookUrl, key, body)
    } catch (e) {
      this.recordFailure(bot.id, runId, failureReason(e))
      throw e
    }
    this.deps.record.execute({
      kind: 'task',
      botId: bot.id,
      task,
      t3ThreadId: null,
      runId,
      at: this.at()
    })
  }

  private async viaT3(bot: Bot, task: string, t3ProjectId: string): Promise<void> {
    if (!bot.t3ProjectIds.includes(t3ProjectId)) {
      throw new InvalidEventError('t3ProjectId', 'is not one of this bot’s T3 projects')
    }
    let t3ThreadId: string
    try {
      t3ThreadId = await this.deps.t3.startThread(
        t3ProjectId,
        task,
        task.slice(0, THREAD_TITLE_CHARS)
      )
    } catch (e) {
      this.recordFailure(bot.id, null, 't3_error')
      throw e
    }
    this.deps.record.execute({
      kind: 'task',
      botId: bot.id,
      task,
      t3ThreadId,
      runId: null,
      at: this.at()
    })
  }

  private recordFailure(botId: string, runId: string | null, reason: string): void {
    this.deps.record.execute({ kind: 'task-failed', botId, runId, reason, at: this.at() })
  }

  private at(): string {
    return this.deps.now().toISOString()
  }
}
