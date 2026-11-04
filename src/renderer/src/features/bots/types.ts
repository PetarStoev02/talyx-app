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
  id?: string
  resolved_id?: string
  last_active?: number
  preview?: string
}

export interface Bot {
  meta: BotMeta
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
  members: { profile: string; member_id?: string; display_name?: string }[]
  disbanded_at?: number | null
  // The seq of the room's newest log row; a higher one than last seen is an unread message.
  latest_seq?: number | null
}

export interface RosterSnapshot {
  bots: Bot[]
  folders: Folder[]
  rooms: Room[]
  roomFolders: Record<string, string | null>
  // Rooms pinned to the top of their folder, in order.
  roomPins: string[]
}

export type Selection = { kind: 'bot' | 'room'; id: string } | null
export type BotActivity = 'idle' | 'working' | 'waiting'
