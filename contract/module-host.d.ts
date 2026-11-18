// Generated from src/shared/moduleHost.ts by `npm run module-host` in talyx-app. Do not edit.
import type * as React from 'react'
import type * as jsxRuntime from 'react/jsx-runtime'
/** The block shapes a bot's avatar can take, in picker order. */
export declare const BLOCK_SHAPES: readonly ['cube', 'tall', 'slab', 'stair', 'twin', 'tower']
export type BlockShape = (typeof BLOCK_SHAPES)[number]
export type BlockState = 'idle' | 'working' | 'waiting' | 'offline'
export interface BlockAvatarProps {
  /** `talyx` is the manager: the logo as a block in black and white. */
  shape: BlockShape | 'talyx'
  /** An index into the hues; Talyx has none. */
  hue: number
  size: number
  state?: BlockState
  face?: boolean
  /** Blink, the working bob and the ticks turning between states. */
  animated?: boolean
  /** Degrees about the vertical axis, for the details hero following the cursor. */
  yaw?: number
}
/**
 * A block avatar's look: one of the shapes in one of the hues, and whether its face is drawn (as
 * the bot chose in its details); Talyx is its own `talyx` block.
 */
export interface ModuleLook {
  shape: BlockShape | 'talyx'
  /** An index into the hues, below `avatars.hueCount`. */
  hue: number
  faces: boolean
}
/**
 * A bot as a module sees it: its profile id, the name you know it by, whether it is Talyx, and
 * its avatar's look, to draw with the host's `avatars`.
 */
export interface ModuleBot {
  id: string
  name: string
  manager: boolean
  look: ModuleLook
}
/**
 * Talyx's block avatars, for a module page: the component the roster draws, the shapes, and the
 * hues (oklch angles, in picker order; a look's `hue` is an index), so a module can draw looks of
 * its own in the bots' colors.
 */
export interface ModuleAvatars {
  BlockAvatar: (props: BlockAvatarProps) => React.JSX.Element
  shapes: readonly BlockShape[]
  hueCount: number
  hues: readonly number[]
}
/**
 * The bots' chats, for a module's page: the same path as typing in the chat, so the message shows
 * there, and Talyx's chat answers the bot's questions and approvals as usual.
 */
export interface ModuleChat {
  bots: () => ModuleBot[]
  /** Sends `text` to the bot's chat, starting the chat if it has none. */
  send: (bot: string, text: string) => Promise<void>
  /** The bot's newest replies, oldest first. */
  replies: (bot: string, limit?: number) => Promise<string[]>
}
/** What a module's page component gets from Talyx: the whole contract on the page side. */
export interface ModulePageProps {
  /** Calls an action the module's main side registered with `ctx.handle`. */
  invoke: (action: string, input?: unknown) => Promise<unknown>
}
/**
 * What a module's Background component gets: always mounted while the module runs, also while its
 * page is closed, so it can watch for work and say how much waits on you (the dock's dot).
 */
export interface ModuleBackgroundProps extends ModulePageProps {
  /** How many things wait on you now; 0 clears the dot. A non-count is read as 0. */
  setNeedsYou: (count: number) => void
}
/**
 * A module page with unsaved work asks before Talyx navigates away from it: the module answers
 * false to keep the user on the page, anything else lets them leave. The answer must settle; an
 * answer that never does keeps the user on the page.
 */
export type LeaveGuard = () => boolean | Promise<boolean>
/**
 * The page's half of the contract. A module's renderer.js imports React from here instead of
 * bundling its own, so its components run on Talyx's React (two copies break hooks).
 */
export interface ModulePageHost {
  apiVersion: number
  /** True where Talyx draws a module's Sidebar export; older Talyx has none, so the page navigates. */
  sidebar: boolean
  /** The bots' chats: send a bot a message, read its replies. Older Talyx has none. */
  chat?: ModuleChat
  /** Talyx's block avatars. Older Talyx has none, so a page keeps icons of its own. */
  avatars?: ModuleAvatars
  /**
   * True where the sidebar's `+` offers the module's `createItems`; older Talyx has none, so the
   * page keeps a way to create of its own.
   */
  createItems?: boolean
  /**
   * Asks the page before Talyx navigates away from it (Agents, Settings, another module): the
   * page sets a guard while it holds unsaved work and clears it with null. The guard answers
   * false to keep the user there; its promise must settle. Older Talyx has none.
   */
  setLeaveGuard?: (guard: LeaveGuard | null) => void
  /**
   * True where Talyx keeps a module's Background export mounted while it runs; older Talyx has
   * none, so a page keeps watching on its own while it is open.
   */
  background?: boolean
  React: typeof React
  jsxRuntime: typeof jsxRuntime
}
declare global {
  interface Window {
    talyxModuleHost?: ModulePageHost
  }
}
/** The icons a create item can name; Talyx draws them as its own menus' icons. */
export declare const MODULE_CREATE_ICONS: readonly [
  'plus',
  'task',
  'workflow',
  'folder',
  'file',
  'calendar'
]
export type ModuleCreateIcon = (typeof MODULE_CREATE_ICONS)[number]
/** One thing a module can make, offered in the sidebar's `+` while its page is open. */
export interface ModuleCreateItem {
  id: string
  label: string
  icon?: ModuleCreateIcon
  run: () => void
}
/**
 * What a module's renderer.js exports: its page (the default export), and optionally `Sidebar`,
 * drawn in Talyx's sidebar while its page is open, `Background`, mounted (drawing nothing) while
 * the module runs, and `createItems` (a list, or a function giving it when the menu opens) with
 * `createLabel`, the `+` button's name, offered in the sidebar's `+`. Talyx reads each export
 * only when it has the right kind; an `Icon` export from an older module is ignored.
 */
export interface ModuleExports {
  default: React.ComponentType<ModulePageProps>
  Sidebar?: React.ComponentType<ModulePageProps>
  Background?: React.ComponentType<ModuleBackgroundProps>
  createItems?: ModuleCreateItem[] | (() => ModuleCreateItem[])
  createLabel?: string
}
/** Answers one action of the module's page. The module validates its own input. */
export type ModuleHandler = (input: unknown) => unknown
export interface ModuleLog {
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}
/** What a module's main.js gets from Talyx: the whole contract on the main side. */
export interface ModuleContext {
  /** The module's own folder for what it stores (userData/module-data/<id>). */
  dataDir: string
  /** Answers the module page's `invoke(name, input)`. The module validates its own input. */
  handle: (name: string, handler: ModuleHandler) => void
  engine: {
    http: (request: unknown) => Promise<unknown>
  }
  /** The system's folder chooser, over Talyx's window: the chosen folder, or null if cancelled. */
  pickFolder: (options?: { title?: string }) => Promise<string | null>
  log: ModuleLog
}
/** What a module's main.js exports: both optional, each given 10 seconds to settle. */
export interface ModuleMain {
  activate?: (context: ModuleContext) => unknown
  deactivate?: () => unknown
}
