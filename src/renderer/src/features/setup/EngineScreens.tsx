import { Check } from 'lucide-react'
import { useLanguage } from '@app/providers/useLanguage'
import { Button } from '@shared/ui/button'
import { TalyxLogo } from '@shared/ui/TalyxLogo'
import { EXPECTED_ENGINE_VERSION } from '../../../../shared/engine'
import { CopyButton, ScreenTitle } from './ScreenParts'
import { centeredPanelClass, linkClass, rowClass } from './screenStyles'

// The command `engine.stale` names. Talyx never restarts the gateway itself: main does not own it.
const RESTART_COMMAND = 'talyx-engine gateway restart'

const logo = <TalyxLogo size={40} className="text-foreground" />

/** Found but cannot attach: the engine gate's error, plus a way on to the install. */
export function AttachError({
  message,
  actions
}: {
  message: string
  actions: { recheck: () => void; install: () => void; chooseFile: () => void }
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  return (
    <div className={centeredPanelClass}>
      {logo}
      <ScreenTitle level={2}>{t('engine.errorTitle')}</ScreenTitle>
      <div>
        <p className="text-base text-foreground">{t('engine.errorNext')}</p>
        <p className="text-sm text-muted-foreground wrap-anywhere">{message}</p>
      </div>
      <div className={`${rowClass} justify-center`}>
        <Button className="px-5" onClick={actions.recheck}>
          {t('action.tryAgain')}
        </Button>
        <button className={linkClass} onClick={actions.install}>
          {t('setup.installEngine')}
        </button>
        <button className={linkClass} onClick={actions.chooseFile}>
          {t('engine.chooseFile')}
        </button>
      </div>
    </div>
  )
}

/** Screen 4b, and the Windows note: no steps to run, so the release page and Choose file. */
export function StepsFailed({
  reason,
  releaseUrl,
  actions
}: {
  reason: 'unavailable' | 'mismatch' | 'unsupported'
  releaseUrl: string
  actions: { retry: () => void; chooseFile: () => void }
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const body = {
    unavailable: t('setup.stepsFailedBody'),
    mismatch: t('setup.stepsMismatch'),
    unsupported: t('setup.unsupported')
  }[reason]
  return (
    <div className={centeredPanelClass}>
      {logo}
      <ScreenTitle level={2}>
        {reason === 'unsupported' ? t('setup.installEngine') : t('setup.stepsFailedTitle')}
      </ScreenTitle>
      <p className="max-w-md text-base text-foreground">{body}</p>
      <div className={`${rowClass} justify-center`}>
        {reason !== 'unsupported' && (
          <Button className="px-5" onClick={actions.retry}>
            {t('action.tryAgain')}
          </Button>
        )}
        <Button
          variant="ghost"
          className="bg-secondary px-5"
          // The window guard opens https links in the browser.
          onClick={() => window.open(releaseUrl)}
        >
          {t('setup.openRelease')}
        </Button>
        <button className={linkClass} onClick={actions.chooseFile}>
          {t('engine.chooseFile')}
        </button>
      </div>
    </div>
  )
}

/** Screen 6: the engine attached, with notes for a newer engine or a gateway left on old code. */
export function EngineReady({
  screen,
  onContinue
}: {
  screen: { version: string; newer: boolean; stale: boolean }
  onContinue: () => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  return (
    <div className={centeredPanelClass}>
      {logo}
      <ScreenTitle level={2}>{t('setup.readyTitle')}</ScreenTitle>
      <p className="flex items-center gap-1.5 rounded-full bg-success-subtle px-3 py-0.5 text-sm font-medium text-success">
        <Check size={14} aria-hidden="true" />
        {t('setup.readyBadge').replace('{version}', screen.version)}
      </p>
      <p className="text-base text-muted-foreground">{t('setup.readyBody')}</p>
      {screen.newer && <p className="text-base text-foreground">{t('setup.newer')}</p>}
      {screen.stale && (
        <div className="flex max-w-md flex-col items-center gap-2 rounded-xl bg-warning-subtle px-4 py-3">
          <p className="text-base text-foreground">{t('engine.stale')}</p>
          <CopyButton text={RESTART_COMMAND} label={t('providers.copy')} name={null} />
        </div>
      )}
      <Button className="px-5" onClick={onContinue}>
        {t('setup.continue')}
      </Button>
    </div>
  )
}

/** Screen 6b: an engine older than the one Talyx is built for. */
export function EngineOlder({
  version,
  actions
}: {
  version: string
  actions: { update: () => void; continueAnyway: () => void }
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  return (
    <div className={centeredPanelClass}>
      {logo}
      <ScreenTitle level={2}>{t('setup.olderTitle')}</ScreenTitle>
      <p className="max-w-md rounded-xl bg-warning-subtle px-4 py-3 text-base text-foreground">
        {t('setup.olderBody')
          .replace('{version}', version)
          .replace('{expected}', EXPECTED_ENGINE_VERSION)}
      </p>
      <div className={`${rowClass} justify-center`}>
        <Button className="px-5" onClick={actions.update}>
          {t('setup.update').replace('{version}', EXPECTED_ENGINE_VERSION)}
        </Button>
        <button className={linkClass} onClick={actions.continueAnyway}>
          {t('setup.continueAnyway')}
        </button>
      </div>
    </div>
  )
}
