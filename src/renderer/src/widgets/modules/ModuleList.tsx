import { useState } from 'react'
import { useLanguage, type TranslationKey } from '@shared/lib/i18n'
import { Button } from '@shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@shared/ui/dialog'
import { useModules } from '@features/modules/store'
import { moduleRows, type ModuleRow } from '@features/modules/rows'
import { useOnMount } from '@shared/hooks/useSubscription'

/**
 * The modules the license unlocks, each with Install or Update; Settings adds Uninstall. Opening
 * it reads the catalog afresh; the footer's update button reads the same catalog.
 */
export function ModuleList({ removable }: { removable: boolean }): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const state = useModules((s) => s.state)
  const available = useModules((s) => s.catalog)
  const catalogFailed = useModules((s) => s.catalogFailed)
  const readCatalog = useModules((s) => s.readCatalog)
  const busy = useModules((s) => s.changing)
  const install = useModules((s) => s.install)
  const uninstall = useModules((s) => s.uninstall)
  // Uninstall asks first: after an install it sits where Install was, under the pointer.
  const [uninstalling, setUninstalling] = useState<ModuleRow | null>(null)
  const rows = moduleRows(state, available)

  useOnMount(() => void readCatalog(0))

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
                <Button disabled={busy !== null} onClick={() => void install(row.id)}>
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
                if (uninstalling) void uninstall(uninstalling.id)
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
