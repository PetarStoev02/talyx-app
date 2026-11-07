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
  runRoutine,
  saveRoutine,
  weekdayName
} from '@features/bots/routines'
import type {
  RoutineDetails,
  RoutineDraft,
  RoutineRun,
  ScheduleKind
} from '@features/bots/routines'
import type { TranslationKey } from '@shared/lib/i18n'
import { Button } from '@shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@shared/ui/dialog'
import { Input, NativeSelect, Textarea } from '@shared/ui/input'
import { Loading, Skeleton } from '@shared/ui/skeleton'

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
const RUN_WORDS: Record<'running' | 'finished', TranslationKey> = {
  running: 'routines.runActive',
  finished: 'routines.runFinished'
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
            <RoutineStatus details={details} runs={runs} />
            <div className="flex flex-col items-start gap-2">
              <Button variant="secondary" disabled={running} onClick={() => void runNow()}>
                {running ? t('routines.running') : t('routines.runNow')}
              </Button>
              {runProblem && <ProblemMessage problem={runProblem} />}
            </div>
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

function RoutineStatus({
  details,
  runs
}: {
  details: RoutineDetails
  runs: RoutineRun[]
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const lastRun = details.lastRunAt
    ? [when(details.lastRunAt), details.lastStatus?.replaceAll('_', ' ')]
        .filter(Boolean)
        .join(' · ')
    : t('routines.never')
  return (
    <div className="space-y-2 rounded-xl bg-secondary p-3 text-base">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
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
      <h4 className="pt-1 font-medium">{t('routines.recentRuns')}</h4>
      {runs.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('routines.noRuns')}</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {runs.map((run) => (
            <li key={run.startedAt} className="wrap-break-word">
              {when(new Date(run.startedAt * MS_PER_SECOND))}
              {' · '}
              {run.state === 'stopped' ? run.reason.replaceAll('_', ' ') : t(RUN_WORDS[run.state])}
            </li>
          ))}
        </ul>
      )}
    </div>
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
        <Textarea
          value={draft.instruction}
          rows={3}
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
      </div>
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
      <label className="flex items-center gap-2 text-base">
        <input
          type="checkbox"
          checked={draft.postsToChat}
          onChange={(event) => setDraft({ ...draft, postsToChat: event.target.checked })}
        />
        {t('routines.postToChat')}
      </label>
      {problem && <ProblemMessage problem={problem} />}
      <div className="flex gap-2">
        <Button type="submit" disabled={!ready || busy}>
          {submitLabel}
        </Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
          {t('roster.cancel')}
        </Button>
      </div>
    </form>
  )
}

function when(value: string | Date): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : WHEN.format(date)
}
