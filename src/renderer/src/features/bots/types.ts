export interface BotMeta {
  title?: string
  description?: string
  sectionId?: string | null
  sectionName?: string | null
  pinned?: boolean
  pinnedOrder?: number
  hidden?: boolean
  // The avatar: a block shape name and a hue index. Older clients stored other strings here.
  shape?: string
  color?: number | string
  faces?: boolean
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
  members: { profile: string; member_id?: string; handle?: string; display_name?: string }[]
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
  // Each folder's bots and rooms in the order dragged, by folder id ('' for Unassigned); keys
  // come from rosterItemKey. An item missing from its folder's list shows after the listed ones.
  itemOrder: Record<string, string[]>
}

/** A bot or a room as a row in a folder. */
export type RosterItem = { kind: 'bot'; bot: Bot } | { kind: 'room'; room: Room }

/** A bot (by profile) or a room (by room id), as a drag or a placement names it. */
export interface RosterItemRef {
  kind: 'bot' | 'room'
  id: string
}

/** Any row of the roster: a bot, a room or a folder, as picking several of them names it. */
export interface RosterRowRef {
  kind: 'bot' | 'room' | 'folder'
  id: string
}

export type Selection = { kind: 'bot' | 'room'; id: string } | null
export type BotActivity = 'idle' | 'working' | 'waiting'
