import { describe, it, expect, vi } from 'vitest'
import { GiveTask } from '../../../src/main/domain/office/useCases/GiveTask'
import { SendToThread } from '../../../src/main/domain/office/useCases/SendToThread'
import {
  BotNotReachableError,
  InvalidEventError,
  UnknownBotError
} from '../../../src/main/domain/office/errors'
import {
  WebhookClient,
  WebhookRejectedError,
  WebhookTimeoutError
} from '../../../src/main/infrastructure/office/WebhookClient'
import type { Bot } from '../../../src/main/domain/office/model'

const bot = (over: Partial<Bot> = {}): Bot => ({
  id: 'b1',
  projectId: 'p1',
  name: 'Bot',
  color: '#fff',
  groupIds: [],
  webhookUrl: 'https://hook.example/x',
  t3ProjectIds: ['t3p'],
  grokLink: null,
  ...over
})

function setup(
  b: Bot = bot(),
  o: { trigger?: ReturnType<typeof vi.fn>; eventsUrl?: string | null } = {}
): {
  uc: GiveTask
  trigger: ReturnType<typeof vi.fn>
  record: ReturnType<typeof vi.fn>
  startThread: ReturnType<typeof vi.fn>
} {
  const trigger = o.trigger ?? vi.fn().mockResolvedValue(undefined)
  const record = vi.fn()
  const startThread = vi.fn().mockResolvedValue('th1')
  const uc = new GiveTask({
    roster: { allBots: () => [b] },
    secrets: { get: (n: string) => (n === 'webhook-key:b1' ? 'KEY' : null) },
    webhook: { trigger } as unknown as WebhookClient,
    t3: { startThread },
    record: { execute: record },
    eventsUrl: () => (o.eventsUrl === undefined ? 'https://pub.example' : o.eventsUrl),
    newRunId: () => 'run1',
    now: () => new Date('2026-01-01T00:00:00Z')
  } as unknown as ConstructorParameters<typeof GiveTask>[0])
  return { uc, trigger, record, startThread }
}
const wh = { kind: 'webhook' } as const
const at = '2026-01-01T00:00:00.000Z'

describe('GiveTask', () => {
  it("should post the task to the bot's webhook with its key and record a task", async () => {
    const { uc, trigger, record } = setup()
    await uc.execute({ botId: 'b1', task: 'do it', target: wh })
    expect(trigger).toHaveBeenCalledWith('https://hook.example/x', 'KEY', {
      task: 'do it',
      runId: 'run1',
      replyTo: 'https://pub.example/events',
      bot: 'b1'
    })
    expect(record).toHaveBeenCalledWith({
      kind: 'task',
      botId: 'b1',
      task: 'do it',
      t3ThreadId: null,
      runId: 'run1',
      at
    })
  })

  it('should send replyTo null when the funnel is off', async () => {
    const { uc, trigger } = setup(bot(), { eventsUrl: null })
    await uc.execute({ botId: 'b1', task: 'x', target: wh })
    expect(trigger.mock.calls[0][2].replyTo).toBeNull()
  })

  it.each([
    [new WebhookRejectedError(429), 'http_429'],
    [new WebhookTimeoutError(), 'timeout'],
    [new Error('boom'), 'network']
  ])('should record a failed task and rethrow when the webhook fails (%#)', async (err, reason) => {
    const { uc, record } = setup(bot(), { trigger: vi.fn().mockRejectedValue(err) })
    await expect(uc.execute({ botId: 'b1', task: 'x', target: wh })).rejects.toBe(err)
    expect(record).toHaveBeenCalledWith({
      kind: 'task-failed',
      botId: 'b1',
      runId: 'run1',
      reason,
      at
    })
  })

  it('should refuse a bot without a webhook', async () => {
    const { uc, trigger } = setup(bot({ webhookUrl: null }))
    await expect(uc.execute({ botId: 'b1', task: 'x', target: wh })).rejects.toThrow(
      BotNotReachableError
    )
    expect(trigger).not.toHaveBeenCalled()
  })

  it('should reject unknown bots and blank tasks, and cap task text at 500 chars', async () => {
    const { uc, trigger } = setup()
    await expect(uc.execute({ botId: 'zz', task: 'x', target: wh })).rejects.toThrow(
      UnknownBotError
    )
    await expect(uc.execute({ botId: 'b1', task: '  ', target: wh })).rejects.toThrow(/task/)
    await uc.execute({ botId: 'b1', task: 'a'.repeat(600), target: wh })
    expect(trigger.mock.calls[0][2].task).toHaveLength(500)
  })

  it("should start a T3 thread and record it as the bot's task", async () => {
    const { uc, startThread, record } = setup()
    await uc.execute({ botId: 'b1', task: 'build', target: { kind: 't3', t3ProjectId: 't3p' } })
    expect(startThread).toHaveBeenCalledWith('t3p', 'build', 'build')
    expect(record).toHaveBeenCalledWith({
      kind: 'task',
      botId: 'b1',
      task: 'build',
      t3ThreadId: 'th1',
      runId: null,
      at
    })
  })

  it("should refuse a T3 project that is not one of the bot's", async () => {
    const { uc, startThread } = setup()
    const p = uc.execute({ botId: 'b1', task: 'x', target: { kind: 't3', t3ProjectId: 'other' } })
    await expect(p).rejects.toThrow(InvalidEventError)
    await expect(p).rejects.toThrow(/t3ProjectId/)
    expect(startThread).not.toHaveBeenCalled()
  })

  it('should record t3_error and rethrow when starting the thread fails', async () => {
    const { uc, startThread, record } = setup()
    const err = new Error('cli down')
    startThread.mockRejectedValue(err)
    await expect(
      uc.execute({ botId: 'b1', task: 'x', target: { kind: 't3', t3ProjectId: 't3p' } })
    ).rejects.toBe(err)
    expect(record).toHaveBeenCalledWith({
      kind: 'task-failed',
      botId: 'b1',
      runId: null,
      reason: 't3_error',
      at
    })
  })
})

describe('WebhookClient', () => {
  it('should POST json with a bearer key and a timeout signal', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    await new WebhookClient(f as unknown as typeof fetch).trigger('https://u', 'K', { a: 1 })
    const [url, init] = f.mock.calls[0]
    expect(url).toBe('https://u')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer K',
      'Content-Type': 'application/json'
    })
    expect(init.body).toBe('{"a":1}')
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('should throw WebhookRejectedError with the status only on non-2xx', async () => {
    const f = vi.fn().mockResolvedValue({ ok: false, status: 503 })
    const err = await new WebhookClient(f as unknown as typeof fetch)
      .trigger('https://u', 'K', {})
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(WebhookRejectedError)
    expect((err as WebhookRejectedError).status).toBe(503)
    expect((err as Error).message).not.toContain('K')
  })

  it('should throw WebhookTimeoutError on timeout', async () => {
    const f = vi.fn().mockRejectedValue(new DOMException('t', 'TimeoutError'))
    await expect(
      new WebhookClient(f as unknown as typeof fetch).trigger('https://u', 'K', {})
    ).rejects.toThrow(WebhookTimeoutError)
  })
})

describe('SendToThread', () => {
  it('should send the message to the thread and refuse an empty one', async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    const uc = new SendToThread({ t3: { send } })
    await uc.execute({ threadId: 't', message: 'hi' })
    expect(send).toHaveBeenCalledWith('t', 'hi')
    await expect(uc.execute({ threadId: 't', message: ' ' })).rejects.toThrow(/message/)
  })
})
