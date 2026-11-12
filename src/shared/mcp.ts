// The tools Talyx's MCP server offers: one definition, read by main (the tool list it serves) and by
// the page (which checks a call's arguments against it before running it). Must not import
// 'electron': it compiles in both the node and web tsconfigs.

import { z } from 'zod'

/** The name agents and every bot's profile know the server by. */
export const MCP_SERVER_NAME = 'talyx'
/** Where the server listens on the loopback interface, unless TALYX_MCP_PORT says otherwise. */
export const MCP_DEFAULT_PORT = 47816
export const MCP_PATH = '/mcp'
/** How long main waits for the page to answer a call: the user may be deciding on an approval. */
export const MCP_CALL_TIMEOUT_MS = 10 * 60_000
/** An unanswered approval counts as a no before main gives up on the call, so a late yes can
 *  never change anything after the agent was told the call was dropped. */
export const MCP_APPROVAL_TIMEOUT_MS = 9 * 60_000

/** How an outside agent reaches the running Talyx. */
export interface McpConnection {
  url: string
  token: string
}

/** The line that adds the server to an outside agent (Claude Code's form; others take the same). */
export function mcpAddCommand({ url, token }: McpConnection): string {
  return `claude mcp add --transport http ${MCP_SERVER_NAME} ${url} --header "Authorization: Bearer ${token}"`
}

/** One tool call, as main hands it to the page. */
export interface McpCall {
  id: string
  tool: string
  args: unknown
}

/** The page's answer: what the tool did, or why it did not. */
export interface McpAnswer {
  ok: boolean
  text: string
}

const profile = z.string().min(1).describe('The bot’s profile id, as list_roster shows it')
const folderId = z
  .string()
  .min(1)
  .nullable()
  .describe('A folder id from list_roster; null for Unassigned (the top level)')
const item = {
  kind: z.enum(['bot', 'room']),
  id: z.string().min(1).describe('A bot’s profile id or a room’s room id')
}
const look = z
  .object({
    shape: z.string().min(1).describe('A block shape name, as list_looks shows them'),
    hue: z.number().int().min(0).describe('An index into the hues list_looks shows'),
    faces: z.boolean()
  })
  .describe('The bot’s avatar')
const schedule = z
  .object({
    kind: z.enum(['daily', 'weekdays', 'weekly', 'hours', 'custom']),
    time: z
      .string()
      .regex(/^\d{1,2}:\d{2}$/)
      .optional()
      .describe('HH:MM, for daily, weekdays and weekly'),
    weekday: z.number().int().min(0).max(6).optional().describe('0 is Sunday, for weekly'),
    hours: z.number().int().min(1).max(24).optional().describe('Every this many hours, for hours'),
    custom: z.string().optional().describe('A cron line, for custom')
  })
  .describe('When the routine runs')

/** Each tool's arguments. `destructive` tools ask the user in Talyx before they run. */
export const MCP_TOOLS = {
  list_roster: {
    description:
      'List the bots, folders and rooms in the Talyx roster, with what folder each is in and what is pinned.',
    args: z.object({})
  },
  list_looks: {
    description: 'List the avatar shapes and hues a bot’s look can use.',
    args: z.object({})
  },
  create_bot: {
    description:
      'Create a bot. It gets its own profile, a SOUL from its name and purpose, and an avatar.',
    args: z.object({
      name: z.string().trim().min(1).describe('The bot’s name, as the roster shows it'),
      purpose: z.string().optional().describe('What the bot does, written into its SOUL'),
      folderId: folderId.optional(),
      look: look.optional()
    })
  },
  update_bot: {
    description:
      'Change a bot’s title, description, SOUL, model or look. Only the fields given change. Replacing the SOUL, or a model that costs more, asks the user in Talyx first.',
    args: z.object({
      profile,
      title: z.string().trim().min(1).optional(),
      description: z.string().optional(),
      soul: z.string().optional().describe('The whole new SOUL text; it replaces the old one'),
      model: z
        .object({ provider: z.string().min(1), model: z.string().min(1) })
        .optional()
        .describe('The provider and model the bot runs on'),
      look: look.optional()
    })
  },
  set_reasoning: {
    description: 'Set how hard a bot thinks by default, for its new chats.',
    args: z.object({
      profile,
      level: z.enum(['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'])
    })
  },
  delete_bot: {
    description: 'Delete a bot and everything it keeps. Asks the user in Talyx first.',
    args: z.object({ profile }),
    destructive: true
  },
  create_folder: {
    description: 'Create a roster folder, at the top level or inside another folder.',
    args: z.object({
      name: z.string().trim().min(1),
      parentId: folderId.optional()
    })
  },
  rename_folder: {
    description: 'Rename a roster folder.',
    args: z.object({ folderId: z.string().min(1), name: z.string().trim().min(1) })
  },
  move_folder: {
    description:
      'Move a folder under another folder (or to the top level), in front of a sibling folder or last.',
    args: z.object({
      folderId: z.string().min(1),
      parentId: folderId,
      beforeId: z.string().min(1).nullable().optional().describe('A sibling folder id; null: last')
    })
  },
  delete_folder: {
    description:
      'Delete a folder. Its bots, rooms and subfolders move up to its parent. Asks the user in Talyx first.',
    args: z.object({ folderId: z.string().min(1) }),
    destructive: true
  },
  move_item: {
    description:
      'Move a bot or a room into a folder, in front of another item there or last. Also reorders within a folder. A pinned item leaves the pins.',
    args: z.object({
      ...item,
      folderId,
      before: z
        .object(item)
        .nullable()
        .optional()
        .describe('The bot or room to go in front of; null or absent: last')
    })
  },
  pin_item: {
    description:
      'Pin or unpin a bot or a room. A pinned bot can also go in front of another pinned bot.',
    args: z.object({
      ...item,
      pinned: z.boolean(),
      beforeBot: z
        .string()
        .min(1)
        .optional()
        .describe('For a bot being pinned: the pinned bot\u2019s profile id to go in front of')
    })
  },
  create_room: {
    description: 'Create a group room with two to six bots.',
    args: z.object({
      name: z.string().trim().min(1),
      members: z.array(z.string().min(1)).describe('The bots’ profile ids')
    })
  },
  rename_room: {
    description: 'Rename a group room.',
    args: z.object({ roomId: z.string().min(1), name: z.string().trim().min(1) })
  },
  set_room_members: {
    description:
      'Set which bots are in a group room: two to six profile ids. The room and its history stay; a bot that joins reads the history and answers from the next message.',
    args: z.object({
      roomId: z.string().min(1),
      members: z
        .array(z.string().min(1))
        .describe('The bots\u2019 profile ids, in the order they answer')
    })
  },
  send_room_message: {
    description:
      'Post a message in a group room as the user, only when the user asks for it. Every bot in the room answers it, so never post in a room you are answering in yourself: it starts the room again. read_room_history shows the replies.',
    args: z.object({
      roomId: z.string().min(1),
      text: z.string().trim().min(1).max(20_000)
    })
  },
  read_room_history: {
    description: 'Read a group room\u2019s latest messages, oldest first.',
    args: z.object({
      roomId: z.string().min(1),
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe('How many messages; 50 when absent')
    })
  },
  delete_room: {
    description: 'Delete a group room and its history. Asks the user in Talyx first.',
    args: z.object({ roomId: z.string().min(1) }),
    destructive: true
  },
  list_routines: {
    description: 'List a bot’s routines (scheduled jobs).',
    args: z.object({ profile })
  },
  add_routine: {
    description:
      'Add a routine: an instruction the bot runs on a schedule, also with Talyx closed. Asks the user in Talyx first.',
    args: z.object({
      profile,
      name: z.string().trim().min(1),
      instruction: z.string().trim().min(1),
      schedule,
      postsToChat: z.boolean().optional().describe('Post each run’s result in the bot’s chat')
    })
  },
  set_routine_active: {
    description: 'Pause or resume a routine. Resuming asks the user in Talyx first.',
    args: z.object({ profile, routineId: z.string().min(1), active: z.boolean() })
  },
  delete_routine: {
    description: 'Delete a routine. Asks the user in Talyx first.',
    args: z.object({ profile, routineId: z.string().min(1) }),
    destructive: true
  }
} satisfies Record<string, { description: string; args: z.ZodType; destructive?: boolean }>

export type McpToolName = keyof typeof MCP_TOOLS
export type McpToolArgs<T extends McpToolName> = z.infer<(typeof MCP_TOOLS)[T]['args']>

export function isMcpTool(name: string): name is McpToolName {
  return Object.hasOwn(MCP_TOOLS, name)
}

/** The tool list as MCP's `tools/list` answers it. */
export function mcpToolList(): {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  annotations: { destructiveHint: boolean }
}[] {
  return Object.entries(MCP_TOOLS).map(([name, tool]) => ({
    name,
    description: tool.description,
    inputSchema: z.toJSONSchema(tool.args, { io: 'input' }) as Record<string, unknown>,
    annotations: { destructiveHint: 'destructive' in tool && tool.destructive }
  }))
}

/**
 * A short fingerprint of the tool list, put in the server's address. The engine reloads a server
 * only when its config changes, so a Talyx with new tools gives every bot a new address; their
 * chats then load the new tools instead of keeping the ones they started with.
 */
export function mcpToolsVersion(): string {
  const text = JSON.stringify(mcpToolList())
  // FNV-1a, 32 bits: enough to tell two tool lists apart, no crypto needed in either process.
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}
