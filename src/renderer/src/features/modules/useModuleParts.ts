import { useCallback, useState } from 'react'
import { useLoad } from '@shared/hooks/useLoad'
import { reportError } from '@shared/lib/report'
import { importModule, type ModuleParts } from './host'
import type { ModuleSummary } from '@contract/modules'

/**
 * A running module's page, sidebar and icon; undefined while loading, null when its renderer.js
 * failed (reported). Tagged with the version, so an update never shows the old parts.
 */
export function useModuleParts(module: ModuleSummary): ModuleParts | null | undefined {
  const { id, version } = module
  const tag = `${id}@${version}`
  const [loaded, setLoaded] = useState<{ tag: string; parts: ModuleParts | null } | null>(null)
  const load = useCallback(() => importModule(id, version), [id, version])
  useLoad(load, {
    loaded: (parts) => setLoaded({ tag, parts }),
    failed: (error) => {
      reportError(`module:${id}`, error)
      setLoaded({ tag, parts: null })
    }
  })
  return loaded?.tag === tag ? loaded.parts : undefined
}
