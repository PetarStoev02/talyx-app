import { useEffect } from 'react'
import { useEngine } from '@app/providers/useEngine'
import { useLanguage } from '@app/providers/useLanguage'
import { Button } from '@shared/ui/button'
import { TalyxLogo } from '@shared/ui/TalyxLogo'

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

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <TalyxLogo size={40} className="text-foreground" />
      {!status ? (
        <p className="text-base text-muted-foreground">{t('engine.checking')}</p>
      ) : (
        <>
          <h2 className="text-xl font-semibold text-foreground">
            {status.state === 'missing' ? t('engine.missingTitle') : t('engine.errorTitle')}
          </h2>
          <p className="max-w-md text-base text-foreground">
            {status.state === 'missing' ? t('engine.missingBody') : status.message}
          </p>
          <div className="flex items-center gap-4">
            <Button className="rounded-full px-5" disabled={checking} onClick={() => void check()}>
              {t('engine.retry')}
            </Button>
            <button
              className="text-sm text-foreground underline underline-offset-4 disabled:opacity-50"
              disabled={checking}
              onClick={() => void pickPath()}
            >
              {t('engine.chooseFile')}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
