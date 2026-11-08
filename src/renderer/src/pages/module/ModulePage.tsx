import { useEffect, useState } from 'react'
import { useLanguage } from '@app/providers/useLanguage'
import { PageHeader } from '@shared/ui/page-header'
import { reportError } from '@shared/lib/report'
import {
  importModulePage,
  moduleInvoker,
  moduleStyleUrl,
  type ModulePageProps
} from '@features/modules/host'
import type { ModuleSummary } from '../../../../shared/modules'

type PageComponent = React.ComponentType<ModulePageProps>

/** A module's page: its title row, then the component its renderer.js exports. */
export function ModulePage({ module }: { module: ModuleSummary }): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const { id, version, styled } = module
  const tag = `${id}@${version}`
  // Tagged with the version it loaded, so an update shows nothing stale while the new one loads.
  const [loaded, setLoaded] = useState<{ tag: string; page: PageComponent | null } | null>(null)
  const current = loaded?.tag === tag ? loaded : null

  useEffect(() => {
    let live = true
    importModulePage(id, version)
      .then((page) => live && setLoaded({ tag: `${id}@${version}`, page }))
      .catch((error: unknown) => {
        reportError(`module:${id}`, error)
        if (live) setLoaded({ tag: `${id}@${version}`, page: null })
      })
    return () => {
      live = false
    }
  }, [id, version])

  useEffect(() => {
    if (!styled) return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = moduleStyleUrl(id, version)
    document.head.append(link)
    return () => link.remove()
  }, [id, version, styled])

  return (
    <div className="flex h-full flex-col">
      <PageHeader title={module.name} />
      <div className="min-h-0 flex-1">
        {current?.page ? (
          <current.page invoke={moduleInvoker(id)} />
        ) : (
          current && <p className="p-6 text-base">{t('modules.pageFailed')}</p>
        )}
      </div>
    </div>
  )
}
