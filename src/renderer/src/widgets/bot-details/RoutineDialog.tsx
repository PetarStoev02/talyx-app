import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { useLanguage, type TranslationKey } from '@shared/lib/i18n'
import type { RosterBackend } from '@features/bots/data'
import { ProblemMessage, TryAgain } from '@features/bots/ProblemMessage'
import { problemOf } from '@features/bots/roster'
import type { RosterProblem } from '@features/bots/roster'
import {
  listRoutineRuns,
  loadRoutine,
  openRoutineRun,
  runRoutine,
  saveRoutine
} from '@features/bots/routines'
import type { RoutineDetails, RoutineRun, RunOutput } from '@features/bots/routines'
import { Button } from '@shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@shared/ui/dialog'
import { Loading, Skeleton } from '@shared/ui/skeleton'
import { cn } from '@shared/lib/utils'
import { useOnChange } from '@shared/hooks/useOnChange'
import { RoutineForm } from './RoutineForm'

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

  useOnChange(load, (run) => void run())

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
          <TryAgain problem={problem} onRetry={open} />
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

function when(value: string | Date): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : WHEN.format(date)
}
