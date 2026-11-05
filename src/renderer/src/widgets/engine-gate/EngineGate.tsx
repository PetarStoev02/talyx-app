import { useEffect, useState } from 'react'
import { useEngine } from '@app/providers/useEngine'
import { useLanguage } from '@app/providers/useLanguage'
import { useSetupBackend } from '@app/providers/useSetupBackend'
import { InstallEngine } from '@features/setup/InstallEngine'
import { linkClass } from '@features/setup/screenStyles'
import { host } from '@shared/engine/host'
import { useElapsed } from '@shared/hooks/useElapsed'
import { reportError } from '@shared/lib/report'
import { Button } from '@shared/ui/button'
import { TalyxLogo } from '@shared/ui/TalyxLogo'

// Fills a plain block (the Agents page) or a flex column (the debug page) and centers in it.
const centered = 'flex h-full flex-1 flex-col items-center justify-center gap-4 px-6 text-center'
// How long the first socket open may take before the wait is shown as a problem.
const FIRST_CONNECT_GRACE_MS = 8_000
// The splash has no title bar; the whole window drags it on macOS.
const dragRegion = { WebkitAppRegion: 'drag' } as React.CSSProperties

/** Shows its children once the engine is attached; until then, why not and how to fix it. */
export function EngineGate({ children }: { children: React.ReactNode }): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const status = useEngine((s) => s.status)
  const checking = useEngine((s) => s.checking)
  const check = useEngine((s) => s.check)
  const pickPath = useEngine((s) => s.pickPath)
  const everConnected = useEngine((s) => s.everConnected)
  const setup = useSetupBackend()
  // Install the engine: the setup's engine screens, until their Continue.
  const [installing, setInstalling] = useState(false)
  // The first open is given a grace period, restarted by each Try again.
  const [waitStart, setWaitStart] = useState(() => Date.now())
  const waitedLong = useElapsed(waitStart, FIRST_CONNECT_GRACE_MS)

  useEffect(() => {
    if (!useEngine.getState().status) void check()
  }, [check])

  if (installing)
    return (
      <div className="scroll-y-stable flex h-full flex-1 flex-col items-center px-6 py-8">
        <div className="my-auto flex w-full flex-col items-center">
          <InstallEngine backend={setup} onReady={() => setInstalling(false)} />
        </div>
      </div>
    )
  if (status?.state === 'attached') {
    // Once open, a drop is a reconnect the banner shows (ConnectionBanner), not a gate.
    if (everConnected) return <>{children}</>
    if (!waitedLong) return <Checking label={t('engine.connecting')} />
    return (
      <div className={centered} role="alert">
        <TalyxLogo size={40} className="text-foreground" />
        <h2 className="text-xl font-semibold text-foreground">{t('engine.connectFailedTitle')}</h2>
        <p className="max-w-md text-base text-foreground">{t('engine.connectFailedBody')}</p>
        <Button
          className="px-5"
          onClick={() => {
            setWaitStart(Date.now())
            host.retryNow().catch((error: unknown) => reportError('engine', error))
          }}
        >
          {t('action.tryAgain')}
        </Button>
      </div>
    )
  }
  if (!status) return <Checking />

  return (
    <div className={centered}>
      <TalyxLogo size={40} className="text-foreground" />
      <h2 className="text-xl font-semibold text-foreground">
        {status.state === 'missing' ? t('engine.missingTitle') : t('engine.errorTitle')}
      </h2>
      {status.state === 'missing' ? (
        <p className="max-w-md text-base text-foreground">{t('engine.missingBody')}</p>
      ) : (
        <div className="max-w-md">
          <p className="text-base text-foreground">{t('engine.errorNext')}</p>
          <p className="text-sm text-muted-foreground wrap-anywhere">{status.message}</p>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-center gap-4">
        {status.state === 'missing' ? (
          <>
            <Button className="px-5" disabled={checking} onClick={() => setInstalling(true)}>
              {t('setup.installEngine')}
            </Button>
            <button className={linkClass} disabled={checking} onClick={() => void check()}>
              {t('action.tryAgain')}
            </button>
          </>
        ) : (
          <Button className="px-5" disabled={checking} onClick={() => void check()}>
            {t('action.tryAgain')}
          </Button>
        )}
        <button className={linkClass} disabled={checking} onClick={() => void pickPath()}>
          {t('engine.chooseFile')}
        </button>
      </div>
    </div>
  )
}

/** The whole window while the first engine check runs: no sidebar, nothing to click yet. */
export function EngineSplash(): React.JSX.Element {
  return (
    <div className="flex h-screen" style={dragRegion}>
      <Checking />
    </div>
  )
}

function Checking({ label }: { label?: string }): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  return (
    <div className={centered} role="status">
      <TalyxLogo size={48} className="animate-pulse text-foreground motion-reduce:animate-none" />
      <p className="text-base text-foreground">{label ?? t('engine.checking')}</p>
    </div>
  )
}
