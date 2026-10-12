import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@shared/ui/button'
import { cn } from '@shared/lib/utils'
import { settingsApi, noticesApi, type NoticeKind } from '@shared/api/ipc'
import type { TranslationKey } from '@shared/lib/i18n'
import { useLanguage } from '@app/providers/useLanguage'
import { isAllDayPause, isNoticesPaused } from '../../../../shared/notices/pause'

type BriefingStyle = 'facts' | 'written'
type KindSwitches = Record<NoticeKind, boolean>

/** Listed in the order they interrupt: the morning first, then the conditions. */
const KINDS: { kind: NoticeKind; labelKey: TranslationKey; helpKey: TranslationKey }[] = [
  {
    kind: 'briefing',
    labelKey: 'settings.notices.briefing',
    helpKey: 'settings.notices.briefingHelp'
  },
  { kind: 'disk', labelKey: 'settings.notices.disk', helpKey: 'settings.notices.diskHelp' },
  {
    kind: 'meeting',
    labelKey: 'settings.notices.meeting',
    helpKey: 'settings.notices.meetingHelp'
  },
  { kind: 'agenda', labelKey: 'settings.notices.agenda', helpKey: 'settings.notices.agendaHelp' },
  { kind: 'clutter', labelKey: 'settings.notices.clutter', helpKey: 'settings.notices.clutterHelp' }
]

/**
 * When Talyx is allowed to speak first. Off on a fresh install, so the only way
 * to be interrupted is to have asked for it here.
 */
export function NoticesSection(): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const [enabled, setEnabled] = useState(false)
  const [time, setTime] = useState('08:00')
  const [style, setStyle] = useState<BriefingStyle>('facts')
  const [kinds, setKinds] = useState<KindSwitches | null>(null)
  // Assumed asked until the settings say otherwise, so a slow load can never
  // put a permission prompt in front of someone who did not touch the switch.
  const [permissionAsked, setPermissionAsked] = useState(true)
  const [pausedUntil, setPausedUntil] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)

  useEffect(() => {
    function load(): void {
      settingsApi
        .get()
        .then((settings) => {
          setEnabled(settings.noticesEnabled)
          setTime(settings.briefingTime)
          setStyle(settings.briefingStyle)
          setKinds(settings.noticeKinds)
          setPermissionAsked(settings.noticesPermissionAsked)
          setPausedUntil(settings.noticesPausedUntil)
        })
        // Without this the per-kind switches stay hidden and nothing says why.
        .catch(() => toast.error(t('settings.notices.loadFailed')))
    }

    load()
    // ⌘⇧Esc / Esc pause from main while Settings is open — refresh on focus.
    function onVisible(): void {
      if (document.visibilityState === 'visible') load()
    }
    window.addEventListener('focus', load)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', load)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [t])

  async function toggleMaster(): Promise<void> {
    const next = !enabled
    setEnabled(next)
    await settingsApi.set({ noticesEnabled: next })
    // Only ever on the first switch-on: macOS asks once and never again, so a
    // second "Notices are on" banner would be a notice nobody asked for, and
    // telling the owner to restart when nothing changed is just wrong.
    if (!next || permissionAsked) return

    // Nothing Talyx posts is shown until macOS has been allowed, and posting is
    // the only way to raise that prompt. Doing it here puts the question in
    // front of the owner while they are looking at the switch they just flipped.
    try {
      await noticesApi.announce()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('settings.notices.announceFailed'))
      return
    }
    setPermissionAsked(true)
    await settingsApi.set({ noticesPermissionAsked: true })
    toast.info(t('settings.notices.permissionHint'))
  }

  async function toggleKind(kind: NoticeKind): Promise<void> {
    if (kinds === null) return
    const next = { ...kinds, [kind]: !kinds[kind] }
    setKinds(next)
    await settingsApi.set({ noticeKinds: next })
  }

  async function changeTime(value: string): Promise<void> {
    setTime(value)
    await settingsApi.set({ briefingTime: value })
  }

  async function changeStyle(value: BriefingStyle): Promise<void> {
    setStyle(value)
    await settingsApi.set({ briefingStyle: value })
  }

  async function resumeNotices(): Promise<void> {
    try {
      await noticesApi.resume()
      setPausedUntil(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('settings.notices.resumeFailed'))
    }
  }

  async function preview(): Promise<void> {
    setPreviewing(true)
    try {
      const { delivered } = await noticesApi.preview()
      // A fresh Mac, before Calendar and Mail automation are granted, has
      // nothing to say — and a button that answers with silence reads as broken.
      if (!delivered) toast.info(t('settings.notices.previewEmpty'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('settings.notices.previewFailed'))
    } finally {
      setPreviewing(false)
    }
  }

  return (
    <div>
      <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
        {t('settings.notices.title')}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">{t('settings.notices.help')}</p>

      <ToggleRow
        label={t('settings.notices.enable')}
        help={t('settings.notices.enableHelp')}
        on={enabled}
        onToggle={toggleMaster}
      />

      {enabled && (
        <p className="mt-2 text-xs text-muted-foreground">{t('settings.notices.killHint')}</p>
      )}

      {isNoticesPaused(pausedUntil, new Date()) && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-border bg-muted px-3 py-2">
          <p className="text-sm text-foreground">
            {isAllDayPause(pausedUntil, new Date())
              ? t('settings.notices.pausedBanner')
              : t('settings.notices.pausedUntilTime').replace(
                  '{time}',
                  new Date(pausedUntil!).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                )}
          </p>
          <Button variant="outline" size="sm" onClick={() => void resumeNotices()}>
            {t('settings.notices.resume')}
          </Button>
        </div>
      )}

      {enabled && permissionAsked && (
        // macOS asks once and never again, so after that the only route back is
        // System Settings. Saying where beats a prompt that will not reappear.
        <p className="mt-2 text-xs text-muted-foreground">
          {t('settings.notices.permissionFootnote')}
        </p>
      )}

      {enabled && kinds !== null && (
        <>
          <div className="mt-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">{t('settings.notices.time')}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('settings.notices.timeHelp')}</p>
            </div>
            <input
              type="time"
              value={time}
              onChange={(e) => void changeTime(e.target.value)}
              aria-label={t('settings.notices.time')}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
            />
          </div>

          <div className="mt-4">
            <p className="text-xs text-muted-foreground">{t('settings.notices.style')}</p>
            <select
              value={style}
              onChange={(e) => void changeStyle(e.target.value as BriefingStyle)}
              aria-label={t('settings.notices.style')}
              className="mt-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
            >
              <option value="facts">{t('settings.notices.styleFacts')}</option>
              <option value="written">{t('settings.notices.styleWritten')}</option>
            </select>
            <p className="mt-1 text-xs text-muted-foreground">{t('settings.notices.styleHelp')}</p>
          </div>

          {KINDS.map(({ kind, labelKey, helpKey }) => (
            <ToggleRow
              key={kind}
              label={t(labelKey)}
              help={t(helpKey)}
              on={kinds[kind]}
              onToggle={() => toggleKind(kind)}
            />
          ))}
        </>
      )}

      <Button variant="outline" size="sm" className="mt-4" onClick={preview} disabled={previewing}>
        {t('settings.notices.preview')}
      </Button>
    </div>
  )
}

function ToggleRow({
  label,
  help,
  on,
  onToggle
}: {
  label: string
  help: string
  on: boolean
  onToggle: () => Promise<void> | void
}): React.JSX.Element {
  return (
    <div className="mt-4 flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-1 text-xs text-muted-foreground">{help}</p>
      </div>
      <button
        onClick={() => void onToggle()}
        role="switch"
        aria-checked={on}
        aria-label={label}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200',
          on ? 'bg-foreground' : 'bg-secondary'
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-5 w-5 translate-y-0.5 rounded-full bg-background shadow-sm ring-0 transition-transform duration-200',
            on ? 'translate-x-5.5' : 'translate-x-0.5'
          )}
        />
      </button>
    </div>
  )
}
