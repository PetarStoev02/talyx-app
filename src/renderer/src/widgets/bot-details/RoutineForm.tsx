import { useState } from 'react'
import { useLanguage, type TranslationKey } from '@shared/lib/i18n'
import { ProblemMessage } from '@features/bots/ProblemMessage'
import { problemOf } from '@features/bots/roster'
import type { RosterProblem } from '@features/bots/roster'
import { MAX_HOURS, composeSchedule, weekdayName } from '@features/bots/routines'
import type { RoutineDraft, ScheduleKind } from '@features/bots/routines'
import { Button } from '@shared/ui/button'
import { Input, NativeSelect, Textarea } from '@shared/ui/input'

const KINDS: Array<[ScheduleKind, TranslationKey]> = [
  ['daily', 'routines.kindDaily'],
  ['weekdays', 'routines.kindWeekdays'],
  ['weekly', 'routines.kindWeekly'],
  ['hours', 'routines.kindHours'],
  ['custom', 'routines.kindCustom']
]
// Cron counts weekdays from Sunday = 0; the list starts on Monday.
const WEEK = [1, 2, 3, 4, 5, 6, 0]
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
