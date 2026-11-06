import { useEffect, useState } from 'react'
import { useEngine } from '@app/providers/useEngine'
import { useLanguage } from '@app/providers/useLanguage'
import { useSetupBackend } from '@app/providers/useSetupBackend'
import { InstallEngine } from '@features/setup/InstallEngine'
import { linkClass } from '@features/setup/screenStyles'
import { useUpdates } from '@features/updates/store'
import { host } from '@shared/engine/host'
import { useElapsed } from '@shared/hooks/useElapsed'
import { reportError } from '@shared/lib/report'
import { Button } from '@shared/ui/button'
import { TalyxLogo } from '@shared/ui/TalyxLogo'

// Fills a plain block (the Agents page, Settings' debug console) and centers in it.
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
  // Install the engine: the setup's engine screens, until their Continue (or Continue anyway) or a
  // cancelled install. An attach error shows them too: their error screen links the install. The
  // footer's update button asks for them when the engine is older than this Talyx needs.
  const installing = useUpdates((s) => s.engineInstallRequested)
  const requestEngineInstall = useUpdates((s) => s.requestEngineInstall)
  const clearEngineInstall = useUpdates((s) => s.clearEngineInstall)
  // The first open is given a grace period, restarted by each Try again.
  const [waitStart, setWaitStart] = useState(() => Date.now())
  const waitedLong = useElapsed(waitStart, FIRST_CONNECT_GRACE_MS)

  useEffect(() => {
    if (!useEngine.getState().status) void check()
  }, [check])

  if (installing || status?.state === 'error')
    return (
      <div className="scroll-y-stable flex h-full flex-1 flex-col items-center px-6 py-8">
        <div className="my-auto flex w-full flex-col items-center">
          <InstallEngine
            backend={setup}
            onReady={clearEngineInstall}
            onCancel={clearEngineInstall}
          />
        </div>
      </div>
    )
  if (status?.state === 'attached') {
    // Once open, a drop is a reconnect the banner shows (ConnectionBanner), not a gate.
    if (everConnected) return <div className="flex h-full min-h-0 flex-1 flex-col">{children}</div>
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
      <h2 className="text-xl font-semibold text-foreground">{t('engine.missingTitle')}</h2>
      <p className="max-w-md text-base text-foreground">{t('engine.missingBody')}</p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Button className="px-5" disabled={checking} onClick={requestEngineInstall}>
          {t('setup.installEngine')}
        </Button>
        <button className={linkClass} disabled={checking} onClick={() => void check()}>
          {t('action.tryAgain')}
        </button>
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
