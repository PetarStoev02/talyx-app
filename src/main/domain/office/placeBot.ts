import { MissingRoomError } from './errors'
import type { Bot, BotSignal, Placement, Room } from './model'

type T3Signal = Extract<BotSignal, { kind: 't3' }>

interface PlaceBotInput {
  bot: Bot
  rooms: Room[]
  signals: BotSignal[] // oldest first
  now: Date
  staleMinutes: number
}

const MS_PER_MINUTE = 60_000
const LOCATING_KINDS: BotSignal['kind'][] = ['chat', 'task', 'idle', 'result', 'task-failed']

// An owner message is the owner talking through a bot, not the bot moving, speaking or being heard.
const notFromOwner = (s: BotSignal): boolean =>
  !((s.kind === 'chat' || s.kind === 'dm') && s.author === 'owner')

export function placeBot({ bot, rooms, signals, now, staleMinutes }: PlaceBotInput): Placement {
  const roomId = (kind: Room['kind']): string => roomOfKind(rooms, kind, bot.projectId)
  const latestChatOrResult = latest(signals, ['chat', 'result'], notFromOwner)
  const base = {
    botId: bot.id,
    task: null,
    t3ThreadId: null,
    t3Link: null,
    waiting: false,
    stale: false,
    lastSeenAt: signals.findLast(notFromOwner)?.at ?? null,
    lastLine: latestChatOrResult && 'text' in latestChatOrResult ? latestChatOrResult.text : null
  }

  const active = latestPerThread(signals).filter((s) => s.status !== 'done')
  if (active.length > 0) {
    const shown = active.at(-1)!
    return {
      ...base,
      roomId: roomId('work'),
      task: shown.title,
      t3ThreadId: shown.t3ThreadId,
      t3Link: shown.link,
      waiting: active.some((s) => s.status === 'waiting')
    }
  }

  const located = latest(signals, LOCATING_KINDS, notFromOwner)
  if (located && now.getTime() - Date.parse(located.at) > staleMinutes * MS_PER_MINUTE) {
    return { ...base, roomId: roomId('chill'), stale: true }
  }
  if (located?.kind === 'chat') {
    const conference = rooms.find((r) => r.kind === 'conference' && r.groupId === located.groupId)
    return { ...base, roomId: conference?.id ?? roomId('chill') }
  }
  if (located?.kind === 'task') {
    return { ...base, roomId: roomId('work'), task: located.task, t3ThreadId: located.t3ThreadId }
  }
  return { ...base, roomId: roomId('chill') }
}

function roomOfKind(rooms: Room[], kind: Room['kind'], projectId: string): string {
  const room = rooms.find((r) => r.kind === kind)
  if (!room) throw new MissingRoomError(kind, projectId)
  return room.id
}

function latest(
  signals: BotSignal[],
  kinds: BotSignal['kind'][],
  accept: (s: BotSignal) => boolean = () => true
): BotSignal | undefined {
  return signals.findLast((s) => kinds.includes(s.kind) && accept(s))
}

function latestPerThread(signals: BotSignal[]): T3Signal[] {
  const byThread = new Map<string, T3Signal>()
  for (const s of signals) if (s.kind === 't3') byThread.set(s.t3ThreadId, s)
  return [...byThread.values()]
}
