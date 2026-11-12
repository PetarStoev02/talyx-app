import { useState } from 'react'
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import { useLanguage } from '@app/providers/useLanguage'
import { useEngine } from '@app/providers/useEngine'
import { useNavigation } from '@app/providers/useNavigation'
import { Button } from '@shared/ui/button'
import { cn } from '@shared/lib/utils'
import { engineSummary, type EngineSummary } from '@features/setup/engineSummary'
import { RestartHint } from '@features/setup/EngineScreens'
import { useUpdates } from '@features/updates/store'
import { timeInWords } from '@features/bots/roster'
import { useNow } from '@shared/hooks/useNow'
import { AgentAccess } from './AgentAccess'

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

// A check can finish in a few milliseconds; the icon spins at least this long so the click shows.
const MIN_SPIN_MS = 600

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
  // Moves "Checked just now" on to "Checked 1 minute ago" without a click.
  const now = useNow()
  const check = useEngine((s) => s.check)
  const pickPath = useEngine((s) => s.pickPath)
  const navigate = useNavigation((s) => s.navigate)
  const requestEngineInstall = useUpdates((s) => s.requestEngineInstall)
  const summary: EngineSummary = engineSummary(status)
  const [consoleOpen, setConsoleOpen] = useState(false)
  // What a screen reader hears after Check again: the visible line below ages every minute, so it
  // is not a live region itself. Cleared first, so a second check is announced again.
  const [checkNote, setCheckNote] = useState('')
  const [spinning, setSpinning] = useState(false)

  const busy = checking || spinning

  async function recheck(): Promise<void> {
    if (busy) return
    setCheckNote('')
    setSpinning(true)
    const spin = new Promise((resolve) => setTimeout(resolve, MIN_SPIN_MS))
    await Promise.all([check(), spin])
    setSpinning(false)
    setCheckNote(t('settings.engineChecked').replace('{when}', t('time.justNow')))
  }

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
        <Button
          variant="secondary"
          // aria-disabled, not disabled: a disabled button drops keyboard focus to the page.
          className="bg-secondary hover:bg-foreground/10 aria-disabled:opacity-50"
          aria-disabled={busy}
          aria-busy={spinning}
          onClick={() => void recheck()}
        >
          <RefreshCw className={cn(spinning && 'animate-spin motion-reduce:animate-none')} />
          {t('settings.engineCheck')}
        </Button>
        <Button
          variant="secondary"
          className="bg-secondary hover:bg-foreground/10"
          disabled={checking}
          onClick={() => void pickPath()}
        >
          {t('engine.chooseFile')}
        </Button>
        {summary.action && <Button onClick={install}>{t(ACTION_KEYS[summary.action])}</Button>}
      </div>
      {checkedAt && (
        // Keyed by the time, so each check fades the line in again even while it reads the same.
        <p key={checkedAt} className="animate-arrive text-sm">
          {t('settings.engineChecked').replace('{when}', timeInWords(checkedAt / 1000, t, now))}
        </p>
      )}
      <p role="status" className="sr-only">
        {checkNote}
      </p>
      <AgentAccess />
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
