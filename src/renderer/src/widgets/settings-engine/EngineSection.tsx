import { useLanguage } from '@app/providers/useLanguage'
import { useEngine } from '@app/providers/useEngine'
import { useNavigation } from '@app/providers/useNavigation'
import { Button } from '@shared/ui/button'
import { engineSummary, type EngineSummary } from '@features/setup/engineSummary'
import { RestartHint } from '@features/setup/EngineScreens'
import { useUpdates } from '@features/updates/store'

const STATE_KEYS = {
  checking: 'settings.engineChecking',
  attached: 'settings.engineAttached',
  missing: 'settings.engineMissing',
  error: 'settings.engineError',
  protocol: 'settings.engineProtocol'
} as const

const ACTION_KEYS = {
  install: 'settings.engineInstall',
  update: 'settings.engineUpdate'
} as const

export function EngineSection(): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const status = useEngine((s) => s.status)
  const checking = useEngine((s) => s.checking)
  const check = useEngine((s) => s.check)
  const pickPath = useEngine((s) => s.pickPath)
  const navigate = useNavigation((s) => s.navigate)
  const requestEngineInstall = useUpdates((s) => s.requestEngineInstall)
  const summary: EngineSummary = engineSummary(status)

  function install(): void {
    // The Agents page's engine gate runs the install, with its output and restart step.
    navigate('agents')
    requestEngineInstall()
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-foreground">{t('settings.engine')}</h2>
      <div className="space-y-1 text-base">
        <p className="font-medium text-foreground">
          {t(STATE_KEYS[summary.state]).replace('{message}', summary.message ?? '')}
        </p>
        {summary.version && (
          <p>{t('settings.engineVersion').replace('{version}', summary.version)}</p>
        )}
        {summary.newer && <p>{t('setup.newer')}</p>}
        {summary.path && (
          <p className="wrap-anywhere">
            {t('settings.engineRuns').replace('{path}', summary.path)}
          </p>
        )}
      </div>
      {summary.stale && summary.path && <RestartHint path={summary.path} recheck={null} />}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={checking} onClick={() => void check()}>
          {t('settings.engineCheck')}
        </Button>
        <Button variant="secondary" disabled={checking} onClick={() => void pickPath()}>
          {t('engine.chooseFile')}
        </Button>
        {summary.action && <Button onClick={install}>{t(ACTION_KEYS[summary.action])}</Button>}
      </div>
    </section>
  )
}
