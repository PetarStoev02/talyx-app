export interface BotMeta {
  title?: string
  description?: string
  sectionId?: string | null
  sectionName?: string | null
  pinned?: boolean
  pinnedOrder?: number
  hidden?: boolean
}

export interface SessionPreview {
  last_active?: number
  preview?: string
}

export interface Bot {
  meta?: BotMeta
  name: string
  display_name?: string
  title?: string | null
  description?: string
  canonical_session?: SessionPreview | null
  last_session?: SessionPreview | null
  ui_meta?: Record<string, unknown>
  ui_meta_revisions?: Record<string, number>
}

export interface Folder {
  id: string
  name: string
  parentId?: string
}

export interface Room {
  room_id: string
  name: string
  members: { profile: string; display_name?: string }[]
  disbanded_at?: number | null
}

export interface RosterSnapshot {
  bots: Bot[]
  folders: Folder[]
  rooms: Room[]
  roomFolders: Record<string, string | null>
}

export type Selection = { kind: 'bot' | 'room'; id: string } | null
export type BotActivity = 'idle' | 'working' | 'waiting'
