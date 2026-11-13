import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useLanguage } from '@app/providers/useLanguage'
import type { RosterBackend } from '@features/bots/data'
import { ProblemMessage } from '@features/bots/ProblemMessage'
import { problemOf } from '@features/bots/roster'
import type { RosterProblem } from '@features/bots/roster'
import {
  MAX_HOURS,
  composeSchedule,
  listRoutineRuns,
  loadRoutine,
  openRoutineRun,
  runRoutine,
  saveRoutine,
  weekdayName
} from '@features/bots/routines'
import type {
  RoutineDetails,
  RoutineDraft,
  RoutineRun,
  RunOutput,
  ScheduleKind
} from '@features/bots/routines'
import type { TranslationKey } from '@shared/lib/i18n'
import { Button } from '@shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@shared/ui/dialog'
import { Input, NativeSelect, Textarea } from '@shared/ui/input'
import { Loading, Skeleton } from '@shared/ui/skeleton'
import { cn } from '@shared/lib/utils'

const KINDS: Array<[ScheduleKind, TranslationKey]> = [
  ['daily', 'routines.kindDaily'],
  ['weekdays', 'routines.kindWeekdays'],
  ['weekly', 'routines.kindWeekly'],
  ['hours', 'routines.kindHours'],
  ['custom', 'routines.kindCustom']
]
// Cron counts weekdays from Sunday = 0; the list starts on Monday.
const WEEK = [1, 2, 3, 4, 5, 6, 0]
const MS_PER_SECOND = 1000
const RUN_WORDS: Record<RoutineRun['state'], TranslationKey> = {
  running: 'routines.runActive',
  finished: 'routines.runFinished',
  stopped: 'routines.runStopped'
}
const WHEN = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' })

/** One routine, opened from its row: the form filled in, its runs, and Run now. */
export function RoutineDialog({
  backend,
  profile,
  id,
  onClose,
  onSaved
}: {
  backend: RosterBackend
  profile: string
  id: string
  onClose: () => void
  onSaved: () => Promise<void>
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const [details, setDetails] = useState<RoutineDetails | null>(null)
  const [runs, setRuns] = useState<RoutineRun[]>([])
  const [problem, setProblem] = useState<RosterProblem | null>(null)
  const [running, setRunning] = useState(false)
  const [runProblem, setRunProblem] = useState<RosterProblem | null>(null)

  const load = useCallback(
    (): Promise<void> =>
      Promise.all([loadRoutine(backend, profile, id), listRoutineRuns(backend, profile, id)]).then(
        ([loaded, recent]) => {
          setDetails(loaded)
          setRuns(recent)
          setProblem(null)
        },
        (error: unknown) => setProblem(problemOf(error))
      ),
    [backend, profile, id]
  )

  useEffect(() => {
    void load()
  }, [load])

  async function runNow(): Promise<void> {
    setRunning(true)
    setRunProblem(null)
    try {
      await runRoutine(backend, profile, id)
      toast.success(t('routines.ran'))
    } catch (error) {
      setRunProblem(problemOf(error))
    }
    await load()
    setRunning(false)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !running && onClose()}>
      <DialogContent>
        <DialogTitle>{details?.draft.name ?? t('routines.title')}</DialogTitle>
        <DialogDescription className="sr-only">{t('routines.newHint')}</DialogDescription>
        {!details ? (
          problem ? (
            <ProblemMessage problem={problem} />
          ) : (
            <Loading label={t('routines.detailsLoading')} className="space-y-2">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </Loading>
          )
        ) : (
          <>
            <RoutineStatus
              backend={backend}
              profile={profile}
              details={details}
              runs={runs}
              runAction={
                <Button variant="secondary" disabled={running} onClick={() => void runNow()}>
                  {running ? t('routines.running') : t('routines.runNow')}
                </Button>
              }
            />
            {runProblem && <ProblemMessage problem={runProblem} />}
            <RoutineForm
              initial={details.draft}
              submitLabel={t('routines.save')}
              onCancel={onClose}
              onSubmit={async (draft) => {
                await saveRoutine(backend, profile, { id, before: details.draft, after: draft })
                toast.success(t('routines.saved'))
                await onSaved()
              }}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// Run now sits in the card it changes, so the button reads as part of the run status.
function RoutineStatus({
  backend,
  profile,
  details,
  runs,
  runAction
}: {
  backend: RosterBackend
  profile: string
  details: RoutineDetails
  runs: RoutineRun[]
  runAction: React.ReactNode
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const lastRun = details.lastRunAt
    ? [when(details.lastRunAt), details.lastStatus?.replaceAll('_', ' ')]
        .filter(Boolean)
        .join(' · ')
    : t('routines.never')
  return (
    <div className="space-y-3 rounded-xl bg-secondary p-4 text-base">
      <div className="flex items-start justify-between gap-3">
        <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
          <dt className="text-muted-foreground">{t('routines.nextRun')}</dt>
          <dd>{details.nextRunAt ? when(details.nextRunAt) : t('routines.notScheduled')}</dd>
          <dt className="text-muted-foreground">{t('routines.lastRun')}</dt>
          <dd>{lastRun}</dd>
          {details.lastError && (
            <>
              <dt className="text-muted-foreground">{t('routines.lastError')}</dt>
              <dd className="text-destructive-text wrap-break-word">{details.lastError}</dd>
            </>
          )}
        </dl>
        <div className="shrink-0">{runAction}</div>
      </div>
      <div className="space-y-1">
        <h4 className="font-medium">{t('routines.recentRuns')}</h4>
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('routines.noRuns')}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {runs.map((run) => (
              // A run that was still going when opened reads its output again once it ends.
              <li key={`${run.id}:${run.state}`}>
                <RunRow backend={backend} profile={profile} run={run} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// One run: its time and outcome, opened to read what it wrote and why it stopped.
function RunRow({
  backend,
  profile,
  run
}: {
  backend: RosterBackend
  profile: string
  run: RoutineRun
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const [opened, setOpened] = useState<RunOutput | null>(null)
  const [problem, setProblem] = useState<RosterProblem | null>(null)

  function open(): void {
    if (opened && run.state !== 'running') return
    setProblem(null)
    openRoutineRun(backend, profile, run).then(setOpened, (error: unknown) =>
      setProblem(problemOf(error))
    )
  }

  return (
    <details onToggle={(event) => event.currentTarget.open && open()}>
      <summary className="cursor-pointer wrap-break-word">
        {when(new Date(run.startedAt * MS_PER_SECOND))}
        {' · '}
        <span className={cn(run.state === 'stopped' && 'text-destructive-text')}>
          {run.state === 'stopped' && run.reason
            ? run.reason.replaceAll('_', ' ')
            : t(RUN_WORDS[run.state])}
        </span>
      </summary>
      <div className="mt-1 mb-2 space-y-2 pl-4">
        {problem ? (
          <ProblemMessage problem={problem} />
        ) : !opened ? (
          <Loading label={t('routines.runLoading')}>
            <Skeleton className="h-12 w-full rounded-lg" />
          </Loading>
        ) : (
          <>
            {opened.error && (
              <p className="text-destructive-text wrap-break-word">
                {t('routines.runError').replace('{reason}', opened.error.replaceAll('_', ' '))}
              </p>
            )}
            {/* A long reply scrolls in place, so the run list stays in reach. */}
            <p className="max-h-60 overflow-y-auto rounded-lg bg-card p-2 whitespace-pre-wrap wrap-break-word overscroll-contain">
              {opened.output ?? t('routines.runNoOutput')}
            </p>
            {!run.sessionId && opened.output && (
              <p className="text-muted-foreground">{t('routines.runExcerpt')}</p>
            )}
          </>
        )}
      </div>
    </details>
  )
}

/** The routine form, for a new routine and an open one. It keeps what was typed on a failure. */
export function RoutineForm({
  initial,
  submitLabel,
  onCancel,
  onSubmit
}: {
  initial: RoutineDraft
  submitLabel: string
  onCancel: () => void
  onSubmit: (draft: RoutineDraft) => Promise<void>
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const [draft, setDraft] = useState<RoutineDraft>(initial)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<RosterProblem | null>(null)
  const { schedule } = draft
  const timed = schedule.kind !== 'hours' && schedule.kind !== 'custom'
  const ready =
    draft.name.trim() !== '' &&
    draft.instruction.trim() !== '' &&
    (!timed || schedule.time !== '') &&
    composeSchedule(schedule) !== ''
  const setSchedule = (patch: Partial<RoutineDraft['schedule']>): void =>
    setDraft({ ...draft, schedule: { ...schedule, ...patch } })

  async function submit(): Promise<void> {
    setBusy(true)
    setProblem(null)
    try {
      await onSubmit(draft)
    } catch (error) {
      setProblem(problemOf(error))
      setBusy(false)
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (ready && !busy) void submit()
      }}
    >
      <label className="block text-base">
        {t('routines.name')}
        <Input
          autoFocus
          value={draft.name}
          maxLength={100}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
      </label>
      <label className="block text-base">
        {t('routines.instruction')}
        {/* Drag the corner to read a long instruction whole; past its height it scrolls. */}
        <Textarea
          value={draft.instruction}
          className="h-40 max-h-[70dvh] min-h-24 resize-y overflow-y-auto overscroll-contain"
          placeholder={t('routines.instructionHint')}
          onChange={(event) => setDraft({ ...draft, instruction: event.target.value })}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-base">
          {t('routines.schedule')}
          <NativeSelect
            value={schedule.kind}
            onChange={(event) => setSchedule({ kind: event.target.value as ScheduleKind })}
          >
            {KINDS.map(([kind, label]) => (
              <option key={kind} value={kind}>
                {t(label)}
              </option>
            ))}
          </NativeSelect>
        </label>
        {schedule.kind === 'weekly' && (
          <label className="block text-base">
            {t('routines.day')}
            <NativeSelect
              value={schedule.weekday}
              onChange={(event) => setSchedule({ weekday: Number(event.target.value) })}
            >
              {WEEK.map((day) => (
                <option key={day} value={day}>
                  {weekdayName(day)}
                </option>
              ))}
            </NativeSelect>
          </label>
        )}
        {timed && (
          <label className="block text-base">
            {t('routines.time')}
            <Input
              type="time"
              value={schedule.time}
              onChange={(event) => setSchedule({ time: event.target.value })}
            />
          </label>
        )}
        {schedule.kind === 'hours' && (
          <label className="block text-base">
            {t('routines.hours')}
            <Input
              type="number"
              min={1}
              max={MAX_HOURS}
              value={schedule.hours}
              onChange={(event) =>
                setSchedule({
                  hours: Math.min(
                    MAX_HOURS,
                    Math.max(1, Math.round(Number(event.target.value)) || 1)
                  )
                })
              }
            />
          </label>
        )}
        {schedule.kind === 'custom' && (
          <label className="block text-base">
            {t('routines.custom')}
            <Input
              value={schedule.custom}
              placeholder={t('routines.customHint')}
              onChange={(event) => setSchedule({ custom: event.target.value })}
              className="font-mono"
            />
          </label>
        )}
      </div>
      <div>
        <label className="flex items-center gap-2 text-base">
          <input
            type="checkbox"
            checked={draft.postsToChat}
            aria-describedby="routine-post-hint"
            onChange={(event) => setDraft({ ...draft, postsToChat: event.target.checked })}
          />
          {t('routines.postToChat')}
        </label>
        <span id="routine-post-hint" className="mt-1 block text-sm text-muted-foreground">
          {t('routines.postToChatHint')}
        </span>
      </div>
      {problem && <ProblemMessage problem={problem} />}
      {/* Stays in view while a long form scrolls; -bottom-6 covers the dialog's own padding so
          nothing scrolls visibly below it. Its top edge shows only while it is stuck, that is
          while the form runs on under it. */}
      <div className="sticky -bottom-6 -mx-6 -mb-6 [container-type:scroll-state]">
        <div className="flex gap-3 border-t border-transparent bg-card px-6 pt-3 pb-6 [@container_scroll-state(stuck:bottom)]:border-border">
          <Button type="submit" disabled={!ready || busy}>
            {submitLabel}
          </Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
            {t('roster.cancel')}
          </Button>
        </div>
      </div>
    </form>
  )
}

function when(value: string | Date): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : WHEN.format(date)
}
