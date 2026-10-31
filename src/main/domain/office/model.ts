export type RoomKind = 'conference' | 'work' | 'chill'
export type WindowView = 'none' | 'city' | 'fields'
export interface Project {
  id: string
  name: string
  logoPath: string | null
  windowView: WindowView
}
export interface Group {
  id: string
  projectId: string
  name: string
}
export interface Bot {
  id: string
  projectId: string
  name: string
  color: string
  groupIds: string[]
  webhookUrl: string | null
  t3ProjectIds: string[]
  grokLink: string | null
}
export interface Room {
  id: string
  projectId: string
  name: string
  kind: RoomKind
  groupId: string | null
}
export type T3Status = 'running' | 'waiting' | 'done'
export type Author = 'bot' | 'owner'
export type BotSignal =
  | {
      kind: 'chat'
      botId: string
      groupId: string
      text: string | null
      author: Author
      messageId: string | null
      at: string
    }
  | {
      kind: 'dm'
      botId: string
      author: Author
      text: string
      messageId: string | null
      at: string
    }
  | {
      kind: 'task'
      botId: string
      task: string
      t3ThreadId: string | null
      runId: string | null
      at: string
    }
  | { kind: 'idle'; botId: string; at: string }
  | { kind: 'result'; botId: string; runId: string | null; text: string; at: string }
  | { kind: 'message'; botId: string; toBotId: string; text: string; at: string }
  | { kind: 'task-failed'; botId: string; runId: string | null; reason: string; at: string }
  | {
      kind: 't3'
      botId: string
      t3ThreadId: string
      title: string
      status: T3Status
      link: string | null
      at: string
    }
export interface Placement {
  botId: string
  roomId: string
  task: string | null
  t3ThreadId: string | null
  t3Link: string | null
  waiting: boolean
  stale: boolean
  lastSeenAt: string | null
  lastLine: string | null
}
export interface RoomBox {
  roomId: string
  x: number
  z: number
  w: number
  d: number
}

/** The secret name a bot's Grok webhook key is stored under. */
export const webhookKeyName = (botId: string): string => `webhook-key:${botId}`
