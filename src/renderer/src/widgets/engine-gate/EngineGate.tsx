import { useEffect } from 'react'
import { useEngine } from '@app/providers/useEngine'
import { useLanguage } from '@app/providers/useLanguage'
import { Button } from '@shared/ui/button'
import { TalyxLogo } from '@shared/ui/TalyxLogo'

// Fills a plain block (the Agents page) or a flex column (the debug page) and centers in it.
const centered = 'flex h-full flex-1 flex-col items-center justify-center gap-4 px-6 text-center'
// The splash has no title bar; the whole window drags it on macOS.
const dragRegion = { WebkitAppRegion: 'drag' } as React.CSSProperties

/** Shows its children once the engine is attached; until then, why not and how to fix it. */
export function EngineGate({ children }: { children: React.ReactNode }): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const status = useEngine((s) => s.status)
  const checking = useEngine((s) => s.checking)
  const check = useEngine((s) => s.check)
  const pickPath = useEngine((s) => s.pickPath)

  useEffect(() => {
    if (!useEngine.getState().status) void check()
  }, [check])

  if (status?.state === 'attached') return <>{children}</>
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
        <Button className="px-5" disabled={checking} onClick={() => void check()}>
          {t('action.tryAgain')}
        </Button>
        <button
          className="text-base text-foreground underline underline-offset-4 hover:decoration-2 disabled:opacity-50"
          disabled={checking}
          onClick={() => void pickPath()}
        >
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

function Checking(): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  return (
    <div className={centered} role="status">
      <TalyxLogo size={48} className="animate-pulse text-foreground motion-reduce:animate-none" />
      <p className="text-base text-foreground">{t('engine.checking')}</p>
    </div>
  )
}
