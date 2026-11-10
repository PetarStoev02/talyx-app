import { useEffect } from 'react'
import { useLanguage } from '@app/providers/useLanguage'
import { moduleInvoker, moduleStyleUrl } from '@features/modules/host'
import { useModuleParts } from '@features/modules/useModuleParts'
import type { ModuleSummary } from '../../../../shared/modules'

/** A module's page: the component its renderer.js exports, which draws its own header. */
export function ModulePage({ module }: { module: ModuleSummary }): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const { id, version, styled } = module
  // Undefined while loading, null when the file failed (reported): an update shows nothing stale.
  const parts = useModuleParts(module)

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
      <div className="min-h-0 flex-1">
        {parts ? (
          <parts.page invoke={moduleInvoker(id)} />
        ) : (
          parts === null && <p className="p-6 text-base">{t('modules.pageFailed')}</p>
        )}
      </div>
    </div>
  )
}
