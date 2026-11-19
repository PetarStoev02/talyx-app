import { useState } from 'react'
import { toast } from 'sonner'
import { useLanguage } from '@shared/lib/i18n'
import { settingsApi } from '@shared/api/ipc'
import { reportError } from '@shared/lib/report'
import { Switch } from '@shared/ui/switch'
import { useLoad } from '@shared/hooks/useLoad'

// Main registers a login item on these only; elsewhere the switch would do nothing.
const LOGIN_ITEM_PLATFORMS = ['darwin', 'linux']

// Null where the switch would do nothing, so it stays hidden. Logged even when Settings closed
// meanwhile.
async function readLaunchAtLogin(): Promise<boolean | null> {
  if (import.meta.env.DEV || !LOGIN_ITEM_PLATFORMS.includes(window.electron?.platform ?? ''))
    return null
  try {
    return (await settingsApi.get()).launchAtLogin
  } catch (error) {
    reportError('settings', error)
    throw error
  }
}

/** The switch for starting Talyx at login. A dev run is not the installed app, so it shows nothing. */
export function StartupSection(): React.JSX.Element | null {
  const t = useLanguage((s) => s.t)
  const [enabled, setEnabled] = useState<boolean | null>(null)

  useLoad(readLaunchAtLogin, { loaded: setEnabled })

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
