import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useLanguage } from '@app/providers/useLanguage'
import { useEngine } from '@app/providers/useEngine'
import { useUpdates } from '@features/updates/store'
import { appApi, updaterApi } from '@shared/api/ipc'
import type { TranslationKey } from '@shared/lib/i18n'
import { reportError } from '@shared/lib/report'
import { Button } from '@shared/ui/button'
import { engineLabel, engineSummary } from '@features/setup/engineSummary'
import type { UpdateCheck } from '../../../../shared/updater'

const COPIED_MS = 1500

/** Which Talyx and engine run here, and a redacted report to paste into a bug report. */
export function AboutSection(): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const engine = engineSummary(useEngine((s) => s.status))
  const [version, setVersion] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [checking, setChecking] = useState(false)
  const [check, setCheck] = useState<UpdateCheck | null>(null)
  const requestNotice = useUpdates((s) => s.requestNotice)

  useEffect(() => {
    appApi
      .version()
      .then(setVersion)
      .catch((error: unknown) => reportError('about', error))
  }, [])

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), COPIED_MS)
    return () => clearTimeout(timer)
  }, [copied])

  async function checkForUpdate(): Promise<void> {
    setChecking(true)
    try {
      const result = await updaterApi.check()
      setCheck(result)
      if (result.kind === 'available') requestNotice()
    } catch (error) {
      reportError('about', error)
      setCheck({ kind: 'failed' })
    } finally {
      setChecking(false)
    }
  }

  async function copyDiagnostics(): Promise<void> {
    try {
      // The write starts inside the click with the report still pending: awaiting the report first
      // can outlive the click's permission to write, and the browser then refuses the copy.
      const report = appApi
        .diagnostics(engineLabel(engine))
        .then((text) => new Blob([text], { type: 'text/plain' }))
      await navigator.clipboard.write([new ClipboardItem({ 'text/plain': report })])
      setCopied(true)
    } catch (error) {
      reportError('about', error)
      toast.error(t('settings.errorDiagnostics'))
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-foreground">{t('settings.about')}</h2>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-base">
        {version && (
          <p className="font-medium text-foreground">
            {t('settings.talyxVersion').replace('{version}', version)}
          </p>
        )}
        {engine.version && (
          <p>{t('settings.aboutEngineVersion').replace('{version}', engine.version)}</p>
        )}
        {engine.state === 'missing' && <p>{t('settings.aboutEngineMissing')}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          className="bg-secondary hover:bg-foreground/10"
          disabled={checking}
          onClick={() => void checkForUpdate()}
        >
          {t(checking ? 'settings.checkingUpdates' : 'settings.checkUpdates')}
        </Button>
        <p role="status" className="text-base">
          {!checking && check && checkLabel(check, t)}
        </p>
      </div>
      <div className="space-y-2">
        <p className="text-base">{t('settings.copyDiagnosticsDesc')}</p>
        <Button
          variant="secondary"
          className="bg-secondary hover:bg-foreground/10"
          onClick={() => void copyDiagnostics()}
        >
          {copied ? t('settings.diagnosticsCopied') : t('settings.copyDiagnostics')}
        </Button>
        {/* A focused button's new label is not reliably read out; this region is. */}
        <p role="status" className="sr-only">
          {copied ? t('settings.diagnosticsCopied') : ''}
        </p>
      </div>
    </section>
  )
}

function checkLabel(check: UpdateCheck, t: (key: TranslationKey) => string): string {
  switch (check.kind) {
    case 'available':
      return t('settings.updateAvailable').replace('{version}', check.version)
    case 'up-to-date':
      return t('settings.upToDate')
    case 'failed':
      return t('settings.updateCheckFailed')
  }
}
