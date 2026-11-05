import { useLanguage } from '@app/providers/useLanguage'
import type { ModelLists } from '@features/chat/chat'
import type { ProvidersBackend, ProvidersOverview } from '@features/providers/providers'
import { ScreenTitle } from '@features/setup/ScreenParts'
import { linkClass, panelClass, rowClass } from '@features/setup/screenStyles'
import { hasProvider } from '@features/setup/steps'
import { useSetup } from '@features/setup/store'
import { cn } from '@shared/lib/utils'
import { Button } from '@shared/ui/button'
import { ProvidersSection } from '@widgets/providers'

/**
 * Screens 7 and 8 in one: the same providers form as Settings, Talyx's model picker included,
 * so setup and Settings stay one form. Continue waits for a provider; Skip never does.
 */
export function ProviderStep({
  providers,
  chat,
  onNext
}: {
  providers: ProvidersBackend | null
  chat: ModelLists | null
  onNext: () => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const saved = useSetup((s) => s.hasProvider === true)

  return (
    <div className={cn(panelClass, 'max-w-2xl')}>
      <ScreenTitle level={2}>{t('setup.providerTitle')}</ScreenTitle>
      <p className="text-base text-muted-foreground">{t('setup.providerBody')}</p>
      {providers ? (
        <div className="space-y-10">
          <ProvidersSection backend={providers} chat={chat} onOverview={reportProvider} />
        </div>
      ) : (
        <p className="text-base text-foreground">{t('setup.providerWaiting')}</p>
      )}
      <div className={rowClass}>
        <Button className="px-5" disabled={!saved} onClick={onNext}>
          {t('setup.continue')}
        </Button>
        <button className={linkClass} onClick={onNext}>
          {t('setup.skip')}
        </button>
      </div>
    </div>
  )
}

function reportProvider(overview: ProvidersOverview): void {
  useSetup.getState().setHasProvider(hasProvider(overview))
}
