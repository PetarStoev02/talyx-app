import * as React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { modulesApi } from '@shared/api/ipc'
import { BlockAvatar } from '@shared/ui/BlockAvatar'
import { BLOCK_HUES, BLOCK_SHAPES } from '@shared/ui/blockGeometry'
import type { BlockShape } from '@shared/ui/blockGeometry'
import { setLeaveGuard } from './leaveGuard'
import type { LeaveGuard } from './leaveGuard'
import { MODULE_API_VERSION, MODULE_SCHEME } from '../../../../shared/modules'

/**
 * A block avatar's look: one of the shapes in one of the hues, and whether its face is drawn (as
 * the bot chose in its details); Talyx is its own `talyx` block.
 */
export interface ModuleLook {
  shape: BlockShape | 'talyx'
  // An index into the hues, below `avatars.hueCount`.
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
  BlockAvatar: typeof BlockAvatar
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
export const MODULE_CREATE_ICONS = [
  'plus',
  'task',
  'workflow',
  'folder',
  'file',
  'calendar'
] as const
export type ModuleCreateIcon = (typeof MODULE_CREATE_ICONS)[number]

/** One thing a module can make, offered in the sidebar's `+` while its page is open. */
export interface ModuleCreateItem {
  id: string
  label: string
  icon?: ModuleCreateIcon
  run: () => void
}

/**
 * The module's part of the sidebar's `+`: its items (a list, or a function giving them when the
 * menu opens) and the button's name, such as "Add a task or a workflow".
 */
export interface ModuleCreate {
  label: string | null
  items: () => unknown
}

/**
 * What a module's renderer.js exports: its page (the default export), and optionally `Sidebar`,
 * drawn in Talyx's sidebar while its page is open, `Background`, mounted (drawing nothing) while
 * the module runs, and `createItems` with `createLabel`, offered in the sidebar's `+`. An `Icon`
 * export from an older module is ignored. The version is in the URL so an update imports the new
 * file instead of the one this page already loaded; one URL imports once, so the page, its sidebar
 * and its Background share the module's state.
 */
export interface ModuleParts {
  page: React.ComponentType<ModulePageProps>
  sidebar: React.ComponentType<ModulePageProps> | null
  background: React.ComponentType<ModuleBackgroundProps> | null
  create: ModuleCreate | null
}

export const MODULE_AVATARS: ModuleAvatars = {
  BlockAvatar,
  shapes: BLOCK_SHAPES,
  hueCount: BLOCK_HUES.length,
  hues: BLOCK_HUES
}

// Set by the app layer, which owns the chat; modules reach it only through the host.
let provided: ModuleChat | undefined

export function provideModuleChat(chat: ModuleChat): void {
  provided = chat
}

export async function importModule(id: string, version: string): Promise<ModuleParts> {
  window.talyxModuleHost ??= {
    apiVersion: MODULE_API_VERSION,
    sidebar: true,
    chat: provided,
    avatars: MODULE_AVATARS,
    createItems: true,
    setLeaveGuard,
    background: true,
    React,
    jsxRuntime
  }
  const url = moduleFileUrl(id, 'renderer.js', version)
  const loaded = (await import(/* @vite-ignore */ url)) as Record<string, unknown>
  if (typeof loaded.default !== 'function') throw new Error(`The ${id} module has no page to show.`)
  return {
    page: loaded.default as React.ComponentType<ModulePageProps>,
    sidebar: componentOrNull(loaded.Sidebar) as React.ComponentType<ModulePageProps> | null,
    background: componentOrNull(
      loaded.Background
    ) as React.ComponentType<ModuleBackgroundProps> | null,
    create: createOf(loaded)
  }
}

/** The module's create items as exported (a list, or a function), checked only when read. */
export function createOf(loaded: Record<string, unknown>): ModuleCreate | null {
  const items = loaded.createItems
  if (!Array.isArray(items) && typeof items !== 'function') return null
  return {
    label: typeof loaded.createLabel === 'string' ? loaded.createLabel : null,
    items: () => (typeof items === 'function' ? (items as () => unknown)() : items)
  }
}

/**
 * The create items the `+` shows, read when the menu opens: only well formed ones, and none when
 * the module's function fails (reported by the caller), so a broken module never breaks the menu.
 */
export function createItemsOf(create: ModuleCreate): ModuleCreateItem[] {
  const items = create.items()
  return Array.isArray(items) ? items.filter(isCreateItem) : []
}

function isCreateItem(value: unknown): value is ModuleCreateItem {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  return (
    typeof item.id === 'string' &&
    typeof item.label === 'string' &&
    item.label.trim() !== '' &&
    typeof item.run === 'function' &&
    (item.icon === undefined || MODULE_CREATE_ICONS.includes(item.icon as ModuleCreateIcon))
  )
}

function componentOrNull(value: unknown): React.ComponentType<never> | null {
  return typeof value === 'function' ? (value as React.ComponentType<never>) : null
}

export function moduleStyleUrl(id: string, version: string): string {
  return moduleFileUrl(id, 'style.css', version)
}

/**
 * A module page file: from talyx-module:// in Electron, or through the dev bridge in a browser tab
 * driving a dev run, where that scheme cannot load.
 */
function moduleFileUrl(id: string, file: string, version: string): string {
  const base = window.electron?.bridged ? `/bridge/module/${id}` : `${MODULE_SCHEME}://${id}`
  return `${base}/${file}?v=${encodeURIComponent(version)}`
}

export function moduleInvoker(id: string): ModulePageProps['invoke'] {
  return (action, input) => modulesApi.invoke(id, action, input ?? null)
}
