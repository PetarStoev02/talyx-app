// Office DTOs that cross IPC. Must not import 'electron' or src/main (the web tsconfig
// compiles it too). They mirror src/main/domain/office/model.ts; GetOfficeSnapshot returns
// OfficeSnapshot, so the node typecheck fails if the two ever drift apart.

export interface Project {
  id: string
  name: string
  logoPath: string | null
  windowView: 'none' | 'city' | 'fields'
}
export interface Group {
  id: string
  projectId: string
  name: string
  relayBotId: string | null
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
  kind: 'conference' | 'work' | 'chill'
  groupId: string | null
}
export interface RoomBox {
  roomId: string
  x: number
  z: number
  w: number
  d: number
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

/** A project as the office shows it: the logo inlined, since the CSP only allows data: images. */
export interface ProjectView extends Project {
  logoDataUrl: string | null
}
export interface T3Project {
  id: string
  name: string
}

export interface OfficeSnapshot {
  project: ProjectView
  projects: ProjectView[]
  rooms: (Room & RoomBox)[]
  bots: (Bot & { placement: Placement; webhookReady: boolean })[]
  groups: Group[]
  feed: { botId: string; text: string; at: string }[]
  t3Connected: boolean
  t3Projects: T3Project[]
  funnel: { on: boolean; url: string | null }
}

export interface OfficeGiveTaskInput {
  botId: string
  task: string
  target: { kind: 'webhook' } | { kind: 't3'; t3ProjectId: string }
}
