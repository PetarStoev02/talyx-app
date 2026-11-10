import * as React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { modulesApi } from '@shared/api/ipc'
import { MODULE_API_VERSION, MODULE_SCHEME } from '../../../../shared/modules'

/** A bot as a module sees it: its profile id, the name you know it by, and whether it is Talyx. */
export interface ModuleBot {
  id: string
  name: string
  manager: boolean
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
 * The page's half of the contract. A module's renderer.js imports React from here instead of
 * bundling its own, so its components run on Talyx's React (two copies break hooks).
 */
export interface ModulePageHost {
  apiVersion: number
  /** True where Talyx draws a module's Sidebar export; older Talyx has none, so the page navigates. */
  sidebar: boolean
  /** The bots' chats: send a bot a message, read its replies. Older Talyx has none. */
  chat?: ModuleChat
  React: typeof React
  jsxRuntime: typeof jsxRuntime
}

declare global {
  interface Window {
    talyxModuleHost?: ModulePageHost
  }
}

/**
 * What a module's renderer.js exports: its page (the default export), and optionally `Sidebar`,
 * drawn in Talyx's sidebar while its page is open, and `Icon`, drawn on its button in the sidebar's
 * switch. The version is in the URL so an update imports the new file instead of the one this page
 * already loaded; one URL imports once, so the page and its sidebar share the module's state.
 */
export interface ModuleParts {
  page: React.ComponentType<ModulePageProps>
  sidebar: React.ComponentType<ModulePageProps> | null
  icon: React.ComponentType | null
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
    React,
    jsxRuntime
  }
  const url = moduleFileUrl(id, 'renderer.js', version)
  const loaded = (await import(/* @vite-ignore */ url)) as Record<string, unknown>
  if (typeof loaded.default !== 'function') throw new Error(`The ${id} module has no page to show.`)
  return {
    page: loaded.default as React.ComponentType<ModulePageProps>,
    sidebar: componentOrNull(loaded.Sidebar) as React.ComponentType<ModulePageProps> | null,
    icon: componentOrNull(loaded.Icon) as React.ComponentType | null
  }
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
