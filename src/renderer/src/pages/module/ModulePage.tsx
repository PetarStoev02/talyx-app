import { useStylesheet } from '@shared/hooks/useStylesheet'
import { useLanguage } from '@shared/lib/i18n'
import { moduleInvoker, moduleStyleUrl } from '@features/modules/host'
import { useModuleParts } from '@features/modules/useModuleParts'
import type { ModuleSummary } from '@contract/modules'

/** A module's page: the component its renderer.js exports, which draws its own header. */
export function ModulePage({ module }: { module: ModuleSummary }): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const { id, version, styled } = module
  // Undefined while loading, null when the file failed (reported): an update shows nothing stale.
  const parts = useModuleParts(module)

  useStylesheet(styled ? moduleStyleUrl(id, version) : null)

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
