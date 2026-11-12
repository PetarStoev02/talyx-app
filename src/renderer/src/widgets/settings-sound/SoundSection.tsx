import { toast } from 'sonner'
import { useLanguage } from '@app/providers/useLanguage'
import { useCompletionSound } from '@features/chat/completionSound'
import { reportError } from '@shared/lib/report'
import { Switch } from '@shared/ui/switch'

/** The switch for the chime that plays when a bot finishes a reply. */
export function SoundSection(): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const enabled = useCompletionSound((s) => s.enabled)

  async function change(next: boolean): Promise<void> {
    try {
      await useCompletionSound.getState().setEnabled(next)
    } catch (error) {
      reportError('settings', error)
      toast.error(t('settings.errorCompletionSound'))
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-foreground">{t('settings.sound')}</h2>
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <h3 id="settings-completion-sound" className="text-base font-medium text-foreground">
            {t('settings.completionSound')}
          </h3>
          <p className="text-base">{t('settings.completionSoundDesc')}</p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(next) => void change(next)}
          aria-labelledby="settings-completion-sound"
        />
      </div>
    </section>
  )
}
