import { useEffect, useRef } from 'react'
import { useLanguage } from '@app/providers/useLanguage'
import { Button } from '@shared/ui/button'
import { CopyButton, ScreenTitle, Spinner } from './ScreenParts'
import { linkClass, panelClass, rowClass } from './screenStyles'

/** Screen 5: the install running, its output streaming in. */
export function InstallRunning({
  output,
  onCancel
}: {
  output: string
  onCancel: () => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  return (
    <div className={panelClass}>
      <ScreenTitle level={2}>
        <span className="flex items-center gap-2">
          <Spinner />
          {t('setup.installingTitle')}
        </span>
      </ScreenTitle>
      <OutputLog output={output} />
      <div className={rowClass}>
        <Button variant="ghost" className="bg-secondary px-5" onClick={onCancel}>
          {t('roster.cancel')}
        </Button>
        <span className="text-sm text-muted-foreground">{t('setup.installingHint')}</span>
      </div>
    </div>
  )
}

/**
 * Screen 5b: the install stopped at a failed command (`failed`), or finished without leaving an
 * engine Talyx can find (`failed` null). The output stays on screen.
 */
export function InstallStopped({
  output,
  failed,
  actions
}: {
  output: string
  failed: { index: number; code: number } | null
  actions: { retry: () => void; showCommands: () => void; chooseFile: () => void }
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  return (
    <div className={panelClass}>
      <ScreenTitle level={2}>{t('setup.stoppedTitle')}</ScreenTitle>
      <p role="alert" className="rounded-xl bg-destructive-subtle px-4 py-3 text-base">
        {failed
          ? t('setup.stoppedBody')
              .replace('{number}', String(failed.index + 1))
              .replace('{code}', String(failed.code))
          : t('setup.notFound')}
      </p>
      <OutputLog output={output} />
      <div className={rowClass}>
        <Button className="px-5" onClick={actions.retry}>
          {t('action.tryAgain')}
        </Button>
        <Button variant="ghost" className="bg-secondary px-5" onClick={actions.showCommands}>
          {t('setup.showCommands')}
        </Button>
        <CopyButton text={output} label={t('setup.copyOutput')} name={null} />
        {!failed && (
          <button className={linkClass} onClick={actions.chooseFile}>
            {t('engine.chooseFile')}
          </button>
        )}
      </div>
    </div>
  )
}

/** The commands' output, terminal-style, kept scrolled to the end as it grows. */
function OutputLog({ output }: { output: string }): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const log = useRef<HTMLPreElement>(null)

  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight
  }, [output])

  return (
    <pre
      ref={log}
      role="log"
      aria-live="polite"
      aria-label={t('setup.output')}
      // Focusable, so the log scrolls from the keyboard.
      tabIndex={0}
      className="h-60 overflow-auto rounded-xl bg-secondary p-3 font-mono text-sm whitespace-pre-wrap text-foreground select-text"
    >
      {output}
    </pre>
  )
}
