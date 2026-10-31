import { InvalidEventError, UnknownBotError } from './errors'
import type { Author, Bot, BotSignal, Group, T3Status } from './model'

const MAX_TEXT = 4000
const MAX_TASK = 500
const MAX_ID = 200
const MAX_TITLE = 200

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

function str(value: unknown, max = MAX_ID): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : null
}

function required(value: unknown, field: string, max = MAX_ID): string {
  const s = str(value, max)
  if (s === null) throw new InvalidEventError(field, 'is required')
  return s
}

function author(value: unknown): Author {
  if (value === undefined) return 'bot'
  if (value === 'bot' || value === 'owner') return value
  throw new InvalidEventError('author', 'must be bot or owner')
}

// A sender's clock is not trusted for ordering or staleness (a future time would never go
// stale), so signals carry the time Talyx received them. The field is still validated so a
// malformed body keeps failing loudly.
function receivedAt(value: unknown, now: Date): string {
  if (value !== undefined && value !== null) {
    const date = typeof value === 'string' ? new Date(value) : new Date(NaN)
    if (Number.isNaN(date.getTime())) throw new InvalidEventError('at', 'must be an ISO date')
  }
  return now.toISOString()
}

export function parseBotEvent(
  body: unknown,
  ctx: { bots: Bot[]; groups: Group[]; now: Date }
): BotSignal {
  const e = asRecord(body)
  const botId = required(e.bot, 'bot')
  const bot = ctx.bots.find((b) => b.id === botId)
  if (!bot) throw new UnknownBotError(botId)
  const at = receivedAt(e.at, ctx.now)

  switch (e.kind) {
    case 'chat': {
      const groupId = required(e.group, 'group')
      if (!ctx.groups.some((g) => g.id === groupId && g.projectId === bot.projectId)) {
        throw new InvalidEventError('group', "is not in the bot's project")
      }
      return {
        kind: 'chat',
        botId,
        groupId,
        text: str(e.text, MAX_TEXT),
        author: author(e.author),
        messageId: str(e.messageId),
        at
      }
    }
    case 'task':
      return {
        kind: 'task',
        botId,
        task: required(e.task, 'task', MAX_TASK),
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
    case 'dm':
      return {
        kind: 'dm',
        botId,
        author: author(e.author),
        text: required(e.text, 'text', MAX_TEXT),
        messageId: str(e.messageId),
        at
      }
    default:
      throw new InvalidEventError('kind', 'must be chat, dm, task, idle, result or message')
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
  const status =
    name && Object.hasOwn(T3_STATUS_BY_EVENT, name) ? T3_STATUS_BY_EVENT[name] : undefined
  if (!status) return null
  const threadId = required(e.threadId, 'threadId')
  const botId = ctx.threadOwner(threadId)
  if (!botId) return null
  return {
    kind: 't3',
    botId,
    t3ThreadId: threadId,
    title: str(e.title, MAX_TITLE) ?? '',
    status,
    link: null,
    at: receivedAt(e.completedAt ?? e.createdAt, ctx.now)
  }
}
