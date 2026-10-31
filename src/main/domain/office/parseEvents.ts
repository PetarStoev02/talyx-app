import { InvalidEventError, UnknownBotError } from './errors'
import type { Bot, BotSignal, Group, T3Status } from './model'

const MAX_TEXT = 500

const T3_STATUS_BY_EVENT: Record<string, T3Status> = {
  'request.opened': 'waiting',
  'request.resolved': 'running',
  'thread.finished': 'done',
  'thread.cancelled': 'done',
  'thread.failed': 'done'
}

type JsonObject = Record<string, unknown>

function asRecord(body: unknown): JsonObject {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new InvalidEventError('body', 'must be an object')
  }
  return body as JsonObject
}

function str(value: unknown, max = Infinity): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : null
}

function required(value: unknown, field: string, max = Infinity): string {
  const s = str(value, max)
  if (s === null) throw new InvalidEventError(field, 'is required')
  return s
}

function parseAt(value: unknown, fallback: Date): string {
  if (value === undefined || value === null) return fallback.toISOString()
  const date = typeof value === 'string' ? new Date(value) : new Date(NaN)
  if (Number.isNaN(date.getTime())) throw new InvalidEventError('at', 'must be an ISO date')
  return date.toISOString()
}

export function parseBotEvent(
  body: unknown,
  ctx: { bots: Bot[]; groups: Group[]; now: Date }
): BotSignal {
  const e = asRecord(body)
  const botId = required(e.bot, 'bot')
  const bot = ctx.bots.find((b) => b.id === botId)
  if (!bot) throw new UnknownBotError(botId)
  const at = parseAt(e.at, ctx.now)

  switch (e.kind) {
    case 'chat': {
      const groupId = required(e.group, 'group')
      if (!ctx.groups.some((g) => g.id === groupId && g.projectId === bot.projectId)) {
        throw new InvalidEventError('group', `${groupId} is not in the bot's project`)
      }
      return { kind: 'chat', botId, groupId, text: str(e.text, MAX_TEXT), at }
    }
    case 'task':
      return {
        kind: 'task',
        botId,
        task: required(e.task, 'task', MAX_TEXT),
        t3ThreadId: str(e.t3ThreadId),
        runId: str(e.runId),
        at
      }
    case 'idle':
      return { kind: 'idle', botId, at }
    case 'result':
      return {
        kind: 'result',
        botId,
        runId: str(e.runId),
        text: required(e.text, 'text', MAX_TEXT),
        at
      }
    case 'message': {
      const toBotId = required(e.to, 'to')
      if (!ctx.bots.some((b) => b.id === toBotId)) throw new UnknownBotError(toBotId)
      return { kind: 'message', botId, toBotId, text: required(e.text, 'text', MAX_TEXT), at }
    }
    default:
      throw new InvalidEventError('kind', 'must be chat, task, idle, result or message')
  }
}

function eventName(e: JsonObject): string | null {
  for (const field of ['event', 'type', 'kind']) {
    const name = str(e[field])
    if (name) return name.replace('-', '.')
  }
  return null
}

export function parseT3ListenEvent(
  body: unknown,
  ctx: { threadOwner: (threadId: string) => string | null; now: Date }
): BotSignal | null {
  const e = asRecord(body)
  const name = eventName(e)
  const status = name ? T3_STATUS_BY_EVENT[name] : undefined
  if (!status) return null
  const threadId = required(e.threadId, 'threadId')
  const botId = ctx.threadOwner(threadId)
  if (!botId) return null
  return {
    kind: 't3',
    botId,
    t3ThreadId: threadId,
    title: str(e.title) ?? '',
    status,
    link: null,
    at: parseAt(e.completedAt ?? e.createdAt, ctx.now)
  }
}
