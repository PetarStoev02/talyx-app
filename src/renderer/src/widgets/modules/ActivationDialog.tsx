import { useEffect, useState } from 'react'
import { useLanguage } from '@app/providers/useLanguage'
import { modulesApi } from '@shared/api/ipc'
import { problemOf } from '@shared/lib/problem'
import { reportError } from '@shared/lib/report'
import { Button } from '@shared/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle
} from '@shared/ui/dialog'
import { Input } from '@shared/ui/input'
import { useModules } from '@features/modules/store'
import { ModuleList } from './ModuleList'

/**
 * "Enter License Key..." from the app menu, or a talyx://activate link: paste or confirm a key,
 * then install what it unlocks. Mounted always and shown only on request, so nothing about
 * modules is on screen for someone who never asks.
 */
export function ActivationDialog(): React.JSX.Element | null {
  const t = useLanguage((s) => s.t)
  const license = useModules((s) => s.state.license)
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState('')
  const [activated, setActivated] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    function take(): void {
      modulesApi
        .takeActivationRequest()
        .then((request) => {
          if (!request) return
          setKey(request.key ?? '')
          setActivated(false)
          setProblem(null)
          setOpen(true)
        })
        .catch((error: unknown) => reportError('modules', error))
    }
    const unsubscribe = modulesApi.onActivationRequested(take)
    // A link that started Talyx asked before this page was listening.
    take()
    return unsubscribe
  }, [])

  async function activate(): Promise<void> {
    setSaving(true)
    setProblem(null)
    try {
      useModules.setState({ state: await modulesApi.activate(key) })
      setActivated(true)
    } catch (error) {
      // An invalid key is the user's typo, not a failure worth the log.
      setProblem(problemOf(error).detail)
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null
  return (
    <Dialog open onOpenChange={setOpen}>
      <DialogContent>
        <DialogTitle>{t('modules.activateTitle')}</DialogTitle>
        {activated && license ? (
          <>
            <DialogDescription>
              {t('modules.activatedFor').replace('{name}', license.name)}
            </DialogDescription>
            <ModuleList removable={false} />
            <DialogClose asChild>
              <Button variant="ghost">{t('modules.done')}</Button>
            </DialogClose>
          </>
        ) : (
          <>
            <DialogDescription>{t('modules.activateHint')}</DialogDescription>
            {license && (
              <p role="note" className="text-base text-muted-foreground">
                {t('modules.activateReplaces').replace('{name}', license.name)}
              </p>
            )}
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault()
                if (key.trim() && !saving) void activate()
              }}
            >
              <label className="block text-base">
                {t('modules.licenseKey')}
                <Input
                  value={key}
                  onChange={(event) => setKey(event.target.value)}
                  placeholder="TALYX-…"
                  spellCheck={false}
                  autoComplete="off"
                  aria-invalid={problem !== null}
                  aria-describedby={problem ? 'license-problem' : undefined}
                />
              </label>
              {problem && (
                <p id="license-problem" role="alert" className="text-base text-destructive">
                  {problem}
                </p>
              )}
              <div className="flex gap-2">
                <Button type="submit" disabled={!key.trim() || saving}>
                  {saving ? t('modules.working') : t('modules.activate')}
                </Button>
                <DialogClose asChild>
                  <Button type="button" variant="ghost">
                    {t('modules.cancel')}
                  </Button>
                </DialogClose>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
