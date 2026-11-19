// Null: a field the bot's record does not hold, or holds in a shape Talyx cannot read (another
// client wrote it). In a patch to saveBotMeta, null removes the field, except for the section.
export interface BotMeta {
  title: string | null
  description: string | null
  // Stored as null for a bot outside every folder, as older clients read it.
  sectionId: string | null
  sectionName: string | null
  pinned: boolean | null
  pinnedOrder: number | null
  hidden: boolean | null
  // The avatar: a block shape name and a hue index. Older clients stored other strings here.
  shape: string | null
  color: number | string | null
  faces: boolean | null
  // Follows Talyx's model: a change of Talyx's model moves this bot too. Null: its own model.
  usesDefault: boolean | null
}

export interface SessionPreview {
  id: string | null
  resolved_id: string | null
  last_active: number | null
  preview: string | null
}

export interface Bot {
  meta: BotMeta
  name: string
  display_name: string | null
  title: string | null
  description: string | null
  canonical_session: SessionPreview | null
  last_session: SessionPreview | null
  ui_meta: Record<string, unknown> | null
  ui_meta_revisions: Record<string, number> | null
}

export interface Folder {
  id: string
  name: string
  parentId: string | null
}

export interface Room {
  room_id: string
  name: string
  members: {
    profile: string
    member_id: string | null
    handle: string | null
    display_name: string | null
  }[]
  disbanded_at: number | null
  // The seq of the room's newest log row; a higher one than last seen is an unread message.
  latest_seq: number | null
}

export interface RosterSnapshot {
  bots: Bot[]
  folders: Folder[]
  rooms: Room[]
  roomFolders: Record<string, string | null>
  // Pinned rooms, in the order pinned: they show as tiles after the pinned bots, not in a folder.
  roomPins: string[]
  // Each folder's bots and rooms in the order dragged, by folder id ('' for Unassigned); keys
  // come from itemKey. An item missing from its folder's list shows after the listed ones.
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
