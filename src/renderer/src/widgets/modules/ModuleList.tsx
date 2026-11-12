import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useLanguage } from '@app/providers/useLanguage'
import { modulesApi } from '@shared/api/ipc'
import type { TranslationKey } from '@shared/lib/i18n'
import { problemOf } from '@shared/lib/problem'
import { reportError } from '@shared/lib/report'
import { Button } from '@shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@shared/ui/dialog'
import { useModules } from '@features/modules/store'
import { moduleRows, type ModuleRow } from '@features/modules/rows'
import type { AvailableModule } from '../../../../shared/modules'

/**
 * The modules the license unlocks, each with Install or Update; Settings adds Uninstall. Reading
 * the catalog is the only network call modules make, and it happens only here.
 */
export function ModuleList({ removable }: { removable: boolean }): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const state = useModules((s) => s.state)
  const [available, setAvailable] = useState<AvailableModule[] | null>(null)
  const [catalogFailed, setCatalogFailed] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  // Uninstall asks first: after an install it sits where Install was, under the pointer.
  const [uninstalling, setUninstalling] = useState<ModuleRow | null>(null)
  const rows = moduleRows(state, available)

  useEffect(() => {
    let live = true
    modulesApi
      .available()
      .then((list) => live && setAvailable(list))
      .catch((error: unknown) => {
        reportError('modules', error)
        if (live) setCatalogFailed(true)
      })
    return () => {
      live = false
    }
  }, [])

  async function run(id: string, change: (id: string) => Promise<unknown>): Promise<void> {
    setBusy(id)
    try {
      await change(id)
    } catch (error) {
      reportError('modules', error)
      toast.error(t('modules.errorChange'), { description: problemOf(error).detail ?? undefined })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-2">
      {catalogFailed && <p className="text-base">{t('modules.catalogFailed')}</p>}
      {rows.length === 0 && !catalogFailed && available && (
        <p className="text-base">{t('modules.noneAvailable')}</p>
      )}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex items-center justify-between gap-4 rounded-lg bg-secondary p-3"
          >
            <div className="min-w-0">
              <p className="font-medium text-foreground">{row.name}</p>
              <p className="text-sm text-muted-foreground">{rowDetail(row, t)}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              {row.action && (
                <Button
                  disabled={busy !== null}
                  onClick={() => void run(row.id, modulesApi.install)}
                >
                  {busy === row.id
                    ? t('modules.working')
                    : t(row.action === 'install' ? 'modules.install' : 'modules.update')}
                </Button>
              )}
              {removable && row.installed !== null && (
                <Button
                  variant="ghost"
                  disabled={busy !== null}
                  onClick={() => setUninstalling(row)}
                >
                  {t('modules.uninstall')}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={!!uninstalling} onOpenChange={(open) => !open && setUninstalling(null)}>
        <DialogContent>
          <DialogTitle>
            {t('modules.uninstallTitle').replace('{name}', uninstalling?.name ?? '')}
          </DialogTitle>
          <DialogDescription>{t('modules.uninstallWarning')}</DialogDescription>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              onClick={() => {
                if (uninstalling) void run(uninstalling.id, modulesApi.uninstall)
                setUninstalling(null)
              }}
            >
              {t('modules.uninstall')}
            </Button>
            <Button variant="ghost" onClick={() => setUninstalling(null)}>
              {t('modules.cancel')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function rowDetail(row: ModuleRow, t: (key: TranslationKey) => string): string {
  if (row.installed === null)
    return t('modules.notInstalled').replace('{version}', row.offered ?? '')
  if (row.status !== 'running') return row.problem ?? t('modules.failed')
  return row.offered
    ? t('modules.updateAvailable')
        .replace('{installed}', row.installed)
        .replace('{offered}', row.offered)
    : t('modules.installedVersion').replace('{version}', row.installed)
}
