import { useCallback, useState } from 'react'
import { useLoad } from '@shared/hooks/useLoad'
import { reportError } from '@shared/lib/report'
import { importModule, type ModuleParts } from './host'
import type { ModuleSummary } from '@contract/modules'

interface Loaded {
  tag: string
  parts: ModuleParts | null
}

/**
 * A running module's page, sidebar and icon; undefined while loading, null when its renderer.js
 * failed (reported). Tagged with the version, so an update never shows the old parts.
 */
export function useModuleParts(module: ModuleSummary): ModuleParts | null | undefined {
  const { id, version } = module
  const tag = `${id}@${version}`
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  // The tag travels with the load, so a late answer for the old version keeps its own tag.
  const load = useCallback(
    (): Promise<Loaded> =>
      importModule(id, version).then(
        (parts) => ({ tag: `${id}@${version}`, parts }),
        (error: unknown) => {
          reportError(`module:${id}`, error)
          return { tag: `${id}@${version}`, parts: null }
        }
      ),
    [id, version]
  )
  useLoad(load, { loaded: setLoaded, failed: (error) => reportError(`module:${id}`, error) })
  return loaded?.tag === tag ? loaded.parts : undefined
}
