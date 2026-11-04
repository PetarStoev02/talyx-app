import { useCallback, useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useLanguage } from '@app/providers/useLanguage'
import type { RosterBackend } from '@features/bots/data'
import { ProblemMessage } from '@features/bots/ProblemMessage'
import { problemOf } from '@features/bots/roster'
import type { RosterProblem } from '@features/bots/roster'
import {
  DEFAULT_SCHEDULE,
  addRoutine,
  composeSchedule,
  describeSchedule,
  listRoutines,
  removeRoutine,
  setRoutineActive
} from '@features/bots/routines'
import type { Routine, RoutineDraft, ScheduleKind } from '@features/bots/routines'
import type { Bot } from '@features/bots/types'
import type { TranslationKey } from '@shared/lib/i18n'
import { Button } from '@shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@shared/ui/dialog'
import { Switch } from '@shared/ui/switch'

type Translate = (key: TranslationKey) => string

const dialogClass = 'border-0 bg-card shadow-none backdrop-blur-none'
const fieldClass = 'mt-2 block w-full rounded-lg bg-secondary px-3 py-2 text-base'
const KINDS: Array<[ScheduleKind, TranslationKey]> = [
  ['daily', 'routines.kindDaily'],
  ['weekdays', 'routines.kindWeekdays'],
  ['weekly', 'routines.kindWeekly'],
  ['hours', 'routines.kindHours'],
  ['custom', 'routines.kindCustom']
]
// Cron counts weekdays from Sunday = 0; the list starts on Monday.
const WEEK = [1, 2, 3, 4, 5, 6, 0]
const MAX_HOURS = 24

/** A bot's routines. Each change goes to the engine at once; the panel's Save is not involved. */
export function RoutinesSection({
  bot,
  backend
}: {
  bot: Bot
  backend: RosterBackend
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const [routines, setRoutines] = useState<Routine[] | null>(null)
  const [problem, setProblem] = useState<RosterProblem | null>(null)
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<Routine | null>(null)

  const load = useCallback(
    (): Promise<void> =>
      listRoutines(backend, bot.name).then(
        (list) => {
          setRoutines(list)
          setProblem(null)
        },
        (error: unknown) => setProblem(problemOf(error))
      ),
    [backend, bot.name]
  )

  useEffect(() => {
    let current = true
    listRoutines(backend, bot.name).then(
      (list) => current && setRoutines(list),
      (error: unknown) => current && setProblem(problemOf(error))
    )
    return () => {
      current = false
    }
  }, [backend, bot.name])

  async function toggle(routine: Routine, active: boolean): Promise<void> {
    setRoutines((list) => list?.map((r) => (r.id === routine.id ? { ...r, active } : r)) ?? null)
    try {
      await setRoutineActive(backend, bot.name, { id: routine.id, active })
    } catch (error) {
      toast.error(failureText(t, error))
    }
    await load()
  }

  async function remove(routine: Routine): Promise<void> {
    try {
      await removeRoutine(backend, bot.name, routine.id)
      setDeleting(null)
    } catch (error) {
      toast.error(failureText(t, error))
    }
    await load()
  }

  return (
    <section aria-labelledby="routines-heading" className="space-y-2 pt-2">
      <div className="flex items-center justify-between">
        <h3 id="routines-heading" className="text-base font-medium">
          {t('routines.title')}
        </h3>
        <button
          className="rounded-full px-3 py-1 text-sm hover:bg-accent"
          onClick={() => setAdding(true)}
        >
          {t('routines.new')}
        </button>
      </div>
      {problem ? (
        <div role="alert">
          <ProblemMessage problem={problem} />
          <button className="mt-2 underline" onClick={() => void load()}>
            {t('roster.retry')}
          </button>
        </div>
      ) : !routines ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t('routines.loading')}
        </p>
      ) : routines.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('routines.empty')}</p>
      ) : (
        <ul className="space-y-2">
          {routines.map((routine) => (
            <li key={routine.id} className="flex items-center gap-2 rounded-xl bg-secondary p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-medium">{routine.name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {scheduleWords(t, routine.schedule)}
                  {routine.postsToChat && ` · ${t('routines.postsToChat')}`}
                </p>
              </div>
              <Switch
                checked={routine.active}
                aria-label={t('routines.run').replace('{name}', routine.name)}
                onCheckedChange={(active) => void toggle(routine, active)}
              />
              <button
                aria-label={t('routines.delete').replace('{name}', routine.name)}
                onClick={() => setDeleting(routine)}
                className="rounded-full p-2 hover:bg-accent"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {adding && (
        <NewRoutineDialog
          onClose={() => setAdding(false)}
          onCreate={async (draft) => {
            await addRoutine(backend, bot.name, draft)
            setAdding(false)
            await load()
          }}
        />
      )}
      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className={dialogClass}>
          <DialogTitle>
            {t('routines.deleteTitle').replace('{name}', deleting?.name ?? '')}
          </DialogTitle>
          <DialogDescription>{t('routines.deleteWarning')}</DialogDescription>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              className="rounded-full text-base"
              onClick={() => deleting && void remove(deleting)}
            >
              {t('routines.deleteConfirm')}
            </Button>
            <Button
              variant="ghost"
              className="rounded-full text-base"
              onClick={() => setDeleting(null)}
            >
              {t('roster.cancel')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}

// Mounted only while open, so the form starts empty each time and survives a failed create.
function NewRoutineDialog({
  onClose,
  onCreate
}: {
  onClose: () => void
  onCreate: (draft: RoutineDraft) => Promise<void>
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const [draft, setDraft] = useState<RoutineDraft>({
    name: '',
    instruction: '',
    schedule: DEFAULT_SCHEDULE,
    postsToChat: true
  })
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
      await onCreate(draft)
    } catch (error) {
      setProblem(problemOf(error))
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className={dialogClass}>
        <DialogTitle>{t('routines.new')}</DialogTitle>
        <DialogDescription>{t('routines.newHint')}</DialogDescription>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (ready && !busy) void submit()
          }}
        >
          <label className="block text-base">
            {t('routines.name')}
            <input
              autoFocus
              value={draft.name}
              maxLength={100}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              className={fieldClass}
            />
          </label>
          <label className="block text-base">
            {t('routines.instruction')}
            <textarea
              value={draft.instruction}
              rows={3}
              placeholder={t('routines.instructionHint')}
              onChange={(event) => setDraft({ ...draft, instruction: event.target.value })}
              className={fieldClass + ' resize-none'}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-base">
              {t('routines.schedule')}
              <select
                value={schedule.kind}
                onChange={(event) => setSchedule({ kind: event.target.value as ScheduleKind })}
                className={fieldClass}
              >
                {KINDS.map(([kind, label]) => (
                  <option key={kind} value={kind}>
                    {t(label)}
                  </option>
                ))}
              </select>
            </label>
            {schedule.kind === 'weekly' && (
              <label className="block text-base">
                {t('routines.day')}
                <select
                  value={schedule.weekday}
                  onChange={(event) => setSchedule({ weekday: Number(event.target.value) })}
                  className={fieldClass}
                >
                  {WEEK.map((day) => (
                    <option key={day} value={day}>
                      {weekdayName(day)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {timed && (
              <label className="block text-base">
                {t('routines.time')}
                <input
                  type="time"
                  value={schedule.time}
                  onChange={(event) => setSchedule({ time: event.target.value })}
                  className={fieldClass}
                />
              </label>
            )}
            {schedule.kind === 'hours' && (
              <label className="block text-base">
                {t('routines.hours')}
                <input
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
                  className={fieldClass}
                />
              </label>
            )}
          </div>
          {schedule.kind === 'custom' && (
            <label className="block text-base">
              {t('routines.custom')}
              <input
                value={schedule.custom}
                placeholder={t('routines.customHint')}
                onChange={(event) => setSchedule({ custom: event.target.value })}
                className={fieldClass + ' font-mono'}
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
          {problem && (
            <div role="alert">
              <ProblemMessage problem={problem} />
            </div>
          )}
          <div className="flex gap-2">
            <Button className="rounded-full text-base" type="submit" disabled={!ready || busy}>
              {t('routines.create')}
            </Button>
            <Button
              className="rounded-full text-base"
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={onClose}
            >
              {t('roster.cancel')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function scheduleWords(t: Translate, schedule: string): string {
  const read = describeSchedule(schedule)
  const time = read.time ?? ''
  switch (read.kind) {
    case 'daily':
      return t('routines.daily').replace('{time}', time)
    case 'weekdays':
      return t('routines.weekdays').replace('{time}', time)
    case 'weekly':
      return t('routines.weekly')
        .replace('{day}', weekdayName(read.weekday ?? 0))
        .replace('{time}', time)
    case 'hours':
      return read.hours === 1
        ? t('routines.everyHour')
        : t('routines.everyHours').replace('{hours}', String(read.hours))
    case 'custom':
      return schedule
  }
}

// 2023-01-01 was a Sunday, so day N of that week is cron's weekday N.
function weekdayName(day: number): string {
  return new Intl.DateTimeFormat('en', { weekday: 'long', timeZone: 'UTC' }).format(
    Date.UTC(2023, 0, 1 + day)
  )
}

function failureText(t: Translate, error: unknown): string {
  const problem = problemOf(error)
  return problem.detail ? `${t(problem.key)} ${problem.detail}` : t(problem.key)
}
