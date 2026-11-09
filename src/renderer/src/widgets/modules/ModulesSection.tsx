import { useState } from 'react'
import { toast } from 'sonner'
import { useLanguage } from '@app/providers/useLanguage'
import { modulesApi } from '@shared/api/ipc'
import { reportError } from '@shared/lib/report'
import { Button } from '@shared/ui/button'
import { useModules } from '@features/modules/store'
import { ModuleList } from './ModuleList'

/** Settings → Modules: only once a license is active, so it never puzzles anyone without one. */
export function ModulesSection(): React.JSX.Element | null {
  const t = useLanguage((s) => s.t)
  const license = useModules((s) => s.state.license)
  const [removing, setRemoving] = useState(false)

  async function removeLicense(): Promise<void> {
    setRemoving(true)
    try {
      useModules.setState({ state: await modulesApi.deactivate() })
    } catch (error) {
      reportError('modules', error)
      toast.error(t('modules.errorChange'))
    } finally {
      setRemoving(false)
    }
  }

  if (!license) return null
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-foreground">{t('modules.title')}</h2>
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-base font-medium text-foreground">
            {t('modules.licensedTo').replace('{name}', license.name)}
          </h3>
          <p className="text-base">
            {license.expires
              ? t('modules.expires').replace('{date}', license.expires)
              : t('modules.noExpiry')}
          </p>
        </div>
        <Button
          variant="secondary"
          className="bg-secondary hover:bg-foreground/10"
          disabled={removing}
          onClick={() => void removeLicense()}
        >
          {t('modules.removeLicense')}
        </Button>
      </div>
      <ModuleList removable />
    </section>
  )
}
