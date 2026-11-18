import * as React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { modulesApi } from '@shared/api/ipc'
import { BlockAvatar } from '@shared/ui/BlockAvatar'
import { BLOCK_HUES } from '@shared/ui/blockGeometry'
import { setLeaveGuard } from './leaveGuard'
import { MODULE_API_VERSION, MODULE_SCHEME } from '@contract/modules'
import {
  BLOCK_SHAPES,
  MODULE_CREATE_ICONS,
  type ModuleAvatars,
  type ModuleBackgroundProps,
  type ModuleChat,
  type ModuleCreateIcon,
  type ModuleCreateItem,
  type ModulePageProps
} from '@contract/moduleHost'

/**
 * The module's part of the sidebar's `+`: its items (a list, or a function giving them when the
 * menu opens) and the button's name, such as "Add a task or a workflow".
 */
export interface ModuleCreate {
  label: string | null
  items: () => unknown
}

/**
 * A module's renderer.js exports (ModuleExports) as Talyx loaded them: each optional part null
 * when missing or of the wrong kind. The version is in the URL so an update imports the new file
 * instead of the one this page already loaded; one URL imports once, so the page, its sidebar and
 * its Background share the module's state.
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
