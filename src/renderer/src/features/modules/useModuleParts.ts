import { useEffect, useState } from 'react'
import { reportError } from '@shared/lib/report'
import { importModule, type ModuleParts } from './host'
import type { ModuleSummary } from '../../../../shared/modules'

/**
 * A running module's page, sidebar and icon; undefined while loading, null when its renderer.js
 * failed (reported). Tagged with the version, so an update never shows the old parts.
 */
export function useModuleParts(module: ModuleSummary): ModuleParts | null | undefined {
  const tag = `${module.id}@${module.version}`
  const [loaded, setLoaded] = useState<{ tag: string; parts: ModuleParts | null } | null>(null)

  useEffect(() => {
    let live = true
    importModule(module.id, module.version)
      .then((parts) => live && setLoaded({ tag, parts }))
      .catch((error: unknown) => {
        reportError(`module:${module.id}`, error)
        if (live) setLoaded({ tag, parts: null })
      })
    return () => {
      live = false
    }
  }, [module.id, module.version, tag])

  return loaded?.tag === tag ? loaded.parts : undefined
}
