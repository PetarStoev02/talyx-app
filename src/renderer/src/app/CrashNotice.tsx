import { useLanguage } from '@app/providers/useLanguage'
import { Button } from '@shared/ui/button'

/** What a crashed part of the app shows (see ErrorBoundary): what happened and the way out. */
export function CrashNotice({
  error,
  whole,
  retry
}: {
  error: Error
  whole: boolean
  retry: () => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center gap-3 p-6 text-center ${whole ? 'h-screen' : 'h-full min-h-40'}`}
    >
      <p className="text-xl font-semibold">{t(whole ? 'crash.appTitle' : 'crash.title')}</p>
      <p className="max-w-md text-base">{t('crash.body')}</p>
      <p className="max-w-md text-sm text-muted-foreground wrap-anywhere">{error.message}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {!whole && <Button onClick={retry}>{t('action.tryAgain')}</Button>}
        <Button variant={whole ? 'default' : 'ghost'} onClick={() => window.location.reload()}>
          {t('crash.reload')}
        </Button>
      </div>
    </div>
  )
}
