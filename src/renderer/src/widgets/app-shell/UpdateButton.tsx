import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Check, Download, ExternalLink, LoaderCircle } from 'lucide-react'
import { useLanguage } from '@app/providers/useLanguage'
import { useNavigation } from '@app/providers/useNavigation'
import { useInstall } from '@features/setup/install'
import { releaseAge, type UpdateItem } from '@features/updates/items'
import { useUpdates } from '@features/updates/store'
import { updaterApi } from '@shared/api/ipc'
import type { TranslationKey } from '@shared/lib/i18n'
import { reportError } from '@shared/lib/report'
import { Button } from '@shared/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@shared/ui/popover'
import type { UpdateFailure } from '../../../../shared/updater'

// A pointer resting on the button opens the popover; leaving it (or the popover) closes it.
const HOVER_OPEN_MS = 150
const HOVER_CLOSE_MS = 200
// The progress ring: a circle just inside the 36px button.
const RING_RADIUS = 16
const RING_LENGTH = 2 * Math.PI * RING_RADIUS

const failureKeys: Record<UpdateFailure, TranslationKey> = {
  checksum: 'update.failedChecksum',
  signature: 'update.failedSignature',
  other: 'update.failedOther'
}

type TalyxState = Extract<UpdateItem, { kind: 'talyx' }>['state']
type Look = 'pending' | 'engine' | 'downloading' | 'installing' | 'ready'

// The button's name says what it shows, as its icon does.
const lookLabels: Record<Look, TranslationKey> = {
  pending: 'update.labelPending',
  engine: 'update.labelEngine',
  downloading: 'update.labelDownloading',
  installing: 'update.labelInstalling',
  ready: 'update.labelReady'
}

/**
 * The footer's update button: a dot while something is pending, a ring while it downloads or
 * installs, a check once the installer is ready. Hover or click shows the popover with each item
 * (engine first) and its action; a click keeps it open until Escape or a click elsewhere.
 */
export function UpdateButton({ items }: { items: UpdateItem[] }): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const engineInstalling = useInstall((s) => s.running)
  const [opened, setOpened] = useState(false)
  // Opened by a click, a key or focus inside: it stays until dismissed, and focus moves in and back.
  const pinned = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const look = buttonLook(items, engineInstalling)
  const talyx = items.find((item) => item.kind === 'talyx')?.state
  const percent = talyx?.kind === 'downloading' ? Math.floor(fraction(talyx) * 100) : 0
  // Settings' "Check for updates" found a release: it shows here, where its actions are.
  const noticeRequested = useUpdates((s) => s.noticeRequested)
  const clearNotice = useUpdates((s) => s.clearNotice)
  const open = opened || noticeRequested

  useEffect(() => () => clearTimeout(timer.current), [])

  // A notice Settings opened counts as opened by a click: it stays until dismissed.
  function isPinned(): boolean {
    return pinned.current || noticeRequested
  }

  function show(next: boolean, pin: boolean): void {
    clearTimeout(timer.current)
    if (next) pinned.current = pin
    else clearNotice()
    setOpened(next)
  }

  function hover(event: React.PointerEvent, entering: boolean): void {
    if (event.pointerType !== 'mouse') return
    clearTimeout(timer.current)
    if (entering && !open) timer.current = setTimeout(() => show(true, false), HOVER_OPEN_MS)
    if (!entering && open && !isPinned())
      timer.current = setTimeout(() => show(false, false), HOVER_CLOSE_MS)
  }

  return (
    <Popover open={open} onOpenChange={(next) => show(next, true)}>
      <PopoverTrigger asChild>
        <button
          aria-label={t(lookLabels[look]).replace('{percent}', String(percent))}
          onPointerEnter={(event) => hover(event, true)}
          onPointerLeave={(event) => hover(event, false)}
          onClick={(event) => {
            // A click pins a popover the pointer opened instead of closing it.
            event.preventDefault()
            show(!(open && isPinned()), true)
          }}
          className="relative inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
        >
          <ButtonIcon look={look} fraction={talyx?.kind === 'downloading' ? fraction(talyx) : 0} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        aria-label={t('update.label')}
        onPointerEnter={(event) => hover(event, true)}
        onPointerLeave={(event) => hover(event, false)}
        onFocus={() => (pinned.current = true)}
        // Hovering never takes focus from where the user was typing, nor gives it back to the button.
        onOpenAutoFocus={(event) => !isPinned() && event.preventDefault()}
        onCloseAutoFocus={(event) => !isPinned() && event.preventDefault()}
        className="flex flex-col divide-y divide-border p-0"
      >
        {items.map((item) =>
          item.kind === 'engine' ? (
            <EngineRow
              key="engine"
              item={item}
              installing={engineInstalling}
              onInstall={() => show(false, true)}
            />
          ) : (
            <TalyxRow key="talyx" state={item.state} onLater={() => show(false, true)} />
          )
        )}
      </PopoverContent>
    </Popover>
  )
}

function buttonLook(items: UpdateItem[], engineInstalling: boolean): Look {
  const first = items[0]
  if (first?.kind === 'engine' && engineInstalling) return 'installing'
  const talyx = items.find((item) => item.kind === 'talyx')?.state
  if (talyx?.kind === 'downloading') return 'downloading'
  if (first?.kind === 'engine') return 'engine'
  return first?.state.kind === 'ready' ? 'ready' : 'pending'
}

function fraction(state: Extract<TalyxState, { kind: 'downloading' }>): number {
  return state.total > 0 ? Math.min(state.received / state.total, 1) : 0
}

function ButtonIcon({ look, fraction }: { look: Look; fraction: number }): React.JSX.Element {
  if (look === 'installing')
    return (
      <LoaderCircle
        aria-hidden="true"
        className="size-[18px] animate-spin motion-reduce:animate-none"
      />
    )
  return (
    <>
      <Download aria-hidden="true" className="size-[18px]" />
      {(look === 'pending' || look === 'engine') && (
        <span className="absolute top-2 right-2 size-1.5 rounded-full bg-foreground" />
      )}
      {look === 'ready' && (
        <span className="absolute right-1.5 bottom-1.5 flex size-3 items-center justify-center rounded-full bg-foreground text-background">
          <Check aria-hidden="true" className="size-2" strokeWidth={4} />
        </span>
      )}
      {look === 'downloading' && (
        <svg aria-hidden="true" viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
          <circle
            cx="18"
            cy="18"
            r={RING_RADIUS}
            fill="none"
            strokeWidth="2"
            className="stroke-foreground/15"
          />
          <circle
            cx="18"
            cy="18"
            r={RING_RADIUS}
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={RING_LENGTH}
            strokeDashoffset={RING_LENGTH * (1 - fraction)}
            className="stroke-foreground transition-[stroke-dashoffset] duration-300"
          />
        </svg>
      )}
    </>
  )
}

function EngineRow({
  item,
  installing,
  onInstall
}: {
  item: Extract<UpdateItem, { kind: 'engine' }>
  installing: boolean
  onInstall: () => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const navigate = useNavigation((s) => s.navigate)
  const requestEngineInstall = useUpdates((s) => s.requestEngineInstall)
  return (
    <section className="flex flex-col gap-2 p-4">
      <h3 className="text-base font-semibold text-foreground">
        {t(installing ? 'update.engineInstalling' : 'update.engineTitle').replace(
          '{version}',
          item.pinned
        )}
      </h3>
      <p className="text-muted-foreground">
        {t('update.engineBody')
          .replace('{installed}', item.installed)
          .replace('{pinned}', item.pinned)}
      </p>
      {!installing && (
        <Button
          className="self-start"
          onClick={async () => {
            // The Agents page's engine gate runs the install, with its output and restart step;
            // a module page holding unsaved work may keep the user there, and then nothing starts.
            if (!(await navigate('agents'))) return
            requestEngineInstall()
            onInstall()
          }}
        >
          {t('update.engineInstall')}
        </Button>
      )}
    </section>
  )
}

function TalyxRow({
  state,
  onLater
}: {
  state: TalyxState
  onLater: () => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const { release } = state
  const openRelease = (): void => void window.open(release.url)
  const age = state.kind === 'available' ? ageLabel(release.publishedAt, t) : null

  return (
    <section className="flex flex-col gap-2 p-4">
      <h3 className="text-base font-semibold text-foreground">{talyxTitle(state, t)}</h3>
      {age && <p className="text-muted-foreground">{age}</p>}
      {state.kind === 'downloading' && (
        <div
          role="progressbar"
          aria-label={t('update.labelDownloading').replace(
            '{percent}',
            String(Math.floor(fraction(state) * 100))
          )}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.floor(fraction(state) * 100)}
          className="h-1.5 overflow-hidden rounded-full bg-foreground/15"
        >
          <div
            className="h-full rounded-full bg-foreground transition-[width] duration-300"
            style={{ width: `${fraction(state) * 100}%` }}
          />
        </div>
      )}
      {state.kind === 'failed' ? (
        <p className="text-muted-foreground">{t(failureKeys[state.reason])}</p>
      ) : (
        <>
          {release.highlights.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-foreground">
              {release.highlights.map((highlight, index) => (
                <li key={index}>
                  <strong className="font-semibold">{highlight.lead}</strong> {highlight.text}
                </li>
              ))}
            </ul>
          )}
          {release.changes > 0 && (
            // Opens in the browser through the window-open guard, never inside the app.
            <a
              href={release.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 self-start text-muted-foreground hover:text-foreground"
            >
              {release.changes === 1
                ? t('update.oneChange')
                : t('update.changes').replace('{count}', String(release.changes))}
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </a>
          )}
        </>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        <TalyxActions state={state} onOpenRelease={openRelease} onLater={onLater} />
      </div>
    </section>
  )
}

function TalyxActions({
  state,
  onOpenRelease,
  onLater
}: {
  state: TalyxState
  onOpenRelease: () => void
  onLater: () => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const releasePage = (
    <Button variant="secondary" onClick={onOpenRelease}>
      {t('update.openRelease')}
    </Button>
  )
  switch (state.kind) {
    case 'downloading':
      return (
        <Button variant="secondary" onClick={() => act(updaterApi.cancel)}>
          {t('update.cancel')}
        </Button>
      )
    case 'ready':
      return <Button onClick={() => act(updaterApi.install)}>{t('update.restart')}</Button>
    case 'available':
    case 'failed':
      // Nothing Talyx can download itself for this computer in the release: only its page.
      if (!state.release.downloadable) return releasePage
      return (
        <>
          <Button onClick={() => act(updaterApi.download)}>
            {t(state.kind === 'failed' ? 'action.tryAgain' : 'update.download')}
          </Button>
          {state.kind === 'failed' ? (
            releasePage
          ) : (
            <Button variant="secondary" onClick={onLater}>
              {t('update.later')}
            </Button>
          )}
        </>
      )
  }
}

function talyxTitle(state: TalyxState, t: (key: TranslationKey) => string): string {
  const { version } = state.release
  switch (state.kind) {
    case 'available':
      return t('update.available').replace('{version}', version)
    case 'downloading':
      return t('update.downloading')
        .replace('{version}', version)
        .replace('{percent}', String(Math.floor(fraction(state) * 100)))
    case 'ready':
      return t('update.readyRestart').replace('{version}', version)
    case 'failed':
      return t('update.failed').replace('{version}', version)
  }
}

function ageLabel(publishedAt: string, t: (key: TranslationKey) => string): string | null {
  const age = releaseAge(publishedAt, Date.now())
  if (!age) return null
  if (age.unit === 'now') return t('update.ageNow')
  if (age.unit === 'days' && age.count === 1) return t('update.ageDay')
  const key = {
    minutes: 'update.ageMinutes',
    hours: 'update.ageHours',
    days: 'update.ageDays'
  } as const
  return t(key[age.unit]).replace('{count}', String(age.count))
}

function act(call: () => Promise<void>): void {
  call().catch((error: unknown) => {
    reportError('updater', error)
    toast.error(error instanceof Error ? error.message : String(error))
  })
}
