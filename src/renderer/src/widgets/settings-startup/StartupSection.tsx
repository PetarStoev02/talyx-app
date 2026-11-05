import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useLanguage } from '@app/providers/useLanguage'
import { settingsApi } from '@shared/api/ipc'
import { reportError } from '@shared/lib/report'
import { Switch } from '@shared/ui/switch'

/** The switch for starting Talyx at login. A dev run is not the installed app, so it shows nothing. */
export function StartupSection(): React.JSX.Element | null {
  const t = useLanguage((s) => s.t)
  const [enabled, setEnabled] = useState<boolean | null>(null)

  useEffect(() => {
    if (import.meta.env.DEV) return
    settingsApi
      .get()
      .then((settings) => setEnabled(settings.launchAtLogin))
      .catch((error: unknown) => reportError('settings', error))
  }, [])

  async function change(next: boolean): Promise<void> {
    try {
      setEnabled((await settingsApi.set({ launchAtLogin: next })).launchAtLogin)
    } catch (error) {
      reportError('settings', error)
      toast.error(t('settings.errorLaunchAtLogin'))
    }
  }

  if (enabled === null) return null
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-foreground">{t('settings.startup')}</h2>
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <h3 id="settings-launch-at-login" className="text-base font-medium text-foreground">
            {t('settings.launchAtLogin')}
          </h3>
          <p className="text-base">{t('settings.launchAtLoginDesc')}</p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(next) => void change(next)}
          aria-labelledby="settings-launch-at-login"
        />
      </div>
    </section>
  )
}
