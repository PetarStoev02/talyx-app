import * as React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { modulesApi } from '@shared/api/ipc'
import { MODULE_API_VERSION, MODULE_SCHEME } from '../../../../shared/modules'

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
  React: typeof React
  jsxRuntime: typeof jsxRuntime
}

declare global {
  interface Window {
    talyxModuleHost?: ModulePageHost
  }
}

/**
 * The page component a module exports by default. The version is in the URL so an update
 * imports the new file instead of the one this page already loaded.
 */
export async function importModulePage(
  id: string,
  version: string
): Promise<React.ComponentType<ModulePageProps>> {
  window.talyxModuleHost ??= { apiVersion: MODULE_API_VERSION, React, jsxRuntime }
  const url = `${MODULE_SCHEME}://${id}/renderer.js?v=${encodeURIComponent(version)}`
  const loaded = (await import(/* @vite-ignore */ url)) as { default?: unknown }
  if (typeof loaded.default !== 'function') throw new Error(`The ${id} module has no page to show.`)
  return loaded.default as React.ComponentType<ModulePageProps>
}

export function moduleStyleUrl(id: string, version: string): string {
  return `${MODULE_SCHEME}://${id}/style.css?v=${encodeURIComponent(version)}`
}

export function moduleInvoker(id: string): ModulePageProps['invoke'] {
  return (action, input) => modulesApi.invoke(id, action, input ?? null)
}
