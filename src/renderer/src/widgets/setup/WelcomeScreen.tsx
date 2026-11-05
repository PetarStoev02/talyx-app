import { useLanguage } from '@app/providers/useLanguage'
import { ScreenTitle } from '@features/setup/ScreenParts'
import { centeredPanelClass } from '@features/setup/screenStyles'
import { Button } from '@shared/ui/button'
import { TalyxLogo } from '@shared/ui/TalyxLogo'

/** Screen 1: what Talyx is, and the three steps ahead. */
export function WelcomeScreen({ onStart }: { onStart: () => void }): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  return (
    <div className={centeredPanelClass}>
      <TalyxLogo size={48} className="text-foreground" />
      <ScreenTitle level={1}>{t('setup.welcomeTitle')}</ScreenTitle>
      <p className="max-w-md text-base text-muted-foreground">{t('setup.welcomeBody')}</p>
      <Button className="px-5" onClick={onStart}>
        {t('setup.getStarted')}
      </Button>
    </div>
  )
}
