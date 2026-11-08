import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useLanguage } from '@app/providers/useLanguage'
import { useEngine } from '@app/providers/useEngine'
import { useNavigation } from '@app/providers/useNavigation'
import { Button } from '@shared/ui/button'
import { engineSummary, type EngineSummary } from '@features/setup/engineSummary'
import { RestartHint } from '@features/setup/EngineScreens'
import { useUpdates } from '@features/updates/store'
import { timeInWords } from '@features/bots/roster'

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

// "Checked just now" turns into "Checked 1 minute ago" without a click.
const CHECKED_TICK_MS = 30_000

/**
 * `debugConsole` is the engine-gated console: the page wraps it, since a widget cannot import the
 * engine gate. It mounts only while open, so a closed field sends nothing to the engine.
 */
export function EngineSection({
  debugConsole
}: {
  debugConsole: React.ReactNode
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const status = useEngine((s) => s.status)
  const checking = useEngine((s) => s.checking)
  const checkedAt = useEngine((s) => s.checkedAt)
  const check = useEngine((s) => s.check)
  const pickPath = useEngine((s) => s.pickPath)
  const navigate = useNavigation((s) => s.navigate)
  const requestEngineInstall = useUpdates((s) => s.requestEngineInstall)
  const summary: EngineSummary = engineSummary(status)
  const [consoleOpen, setConsoleOpen] = useState(false)
  const [, setTick] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setTick((tick) => tick + 1), CHECKED_TICK_MS)
    return () => clearInterval(timer)
  }, [])

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
      {checkedAt && (
        // Keyed by the time, so each check fades the line in again even while it reads the same.
        <p key={checkedAt} className="animate-arrive text-sm" aria-live="polite">
          {t('settings.engineChecked').replace('{when}', timeInWords(checkedAt / 1000, t))}
        </p>
      )}
      <div className="space-y-3">
        <button
          className="flex items-center gap-2 text-base font-medium text-foreground"
          aria-expanded={consoleOpen}
          onClick={() => setConsoleOpen((open) => !open)}
        >
          {consoleOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          {t('settings.engineDebugConsole')}
        </button>
        {consoleOpen && debugConsole}
      </div>
    </section>
  )
}
