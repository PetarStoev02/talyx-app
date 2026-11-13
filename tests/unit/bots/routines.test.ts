import { beforeEach, describe, expect, it } from 'vitest'
import type { RosterBackend } from '../../../src/renderer/src/features/bots/data'
import {
  DEFAULT_SCHEDULE,
  addRoutine,
  composeSchedule,
  describeSchedule,
  listRoutineRuns,
  listRoutines,
  loadRoutine,
  openRoutineRun,
  removeRoutine,
  runRoutine,
  saveRoutine,
  scheduleDraft,
  setRoutineActive
} from '../../../src/renderer/src/features/bots/routines'
import type {
  RoutineDetails,
  RoutineDraft,
  RoutineUpdates,
  ScheduleDraft
} from '../../../src/renderer/src/features/bots/routines'
import { RosterError } from '../../../src/renderer/src/features/bots/roster'
import { backendFor, engineDouble } from './engineDouble'
import type { CronJob, CronRun, EngineDouble } from './engineDouble'

const schedule = (patch: Partial<ScheduleDraft>): ScheduleDraft => ({
  ...DEFAULT_SCHEDULE,
  ...patch
})
const SCHEDULES: [string, ScheduleDraft, string][] = [
  ['daily at 08:00', schedule({ kind: 'daily', time: '08:00' }), '0 8 * * *'],
  ['weekdays at 17:30', schedule({ kind: 'weekdays', time: '17:30' }), '30 17 * * 1-5'],
  [
    'weekly on Monday at 08:00',
    schedule({ kind: 'weekly', time: '08:00', weekday: 1 }),
    '0 8 * * 1'
  ],
  [
    'weekly on Sunday at 09:00',
    schedule({ kind: 'weekly', time: '09:00', weekday: 0 }),
    '0 9 * * 0'
  ],
  ['every 2 hours', schedule({ kind: 'hours', hours: 2 }), 'every 2h'],
  ['a custom line', schedule({ kind: 'custom', custom: '  0 */4 * * *  ' }), '0 */4 * * *']
]

let engine: EngineDouble
let backend: RosterBackend

beforeEach(() => {
  engine = engineDouble()
  backend = backendFor(engine)
})

const draft = (patch: Partial<RoutineDraft> = {}): RoutineDraft => ({
  name: 'Monday cash position',
  instruction: 'Summarise the cash position.',
  schedule: schedule({ kind: 'weekly', time: '08:00', weekday: 1 }),
  postsToChat: true,
  ...patch
})

const run = (patch: Partial<CronRun> & { id: string }): CronRun => ({
  started_at: 1,
  is_active: false,
  end_reason: 'cron_complete',
  title: 'Cash',
  ...patch
})

describe('routines', () => {
  describe('composeSchedule', () => {
    it.each(SCHEDULES)('should write %s', (_name, value, expected) => {
      expect(composeSchedule(value)).toBe(expected)
    })
  })

  describe('describeSchedule', () => {
    it.each(SCHEDULES.slice(0, -1))('should read back %s', (_name, value) => {
      const read = describeSchedule(composeSchedule(value))
      expect(read.kind).toBe(value.kind)
      if (value.kind === 'hours') expect(read.hours).toBe(value.hours)
      else expect(read.time).toBe(value.time)
      if (value.kind === 'weekly') expect(read.weekday).toBe(value.weekday)
    })

    it.each(['60 8 * * *', '0 24 * * *'])(
      'should read an out-of-range time %s as custom',
      (line) => {
        expect(describeSchedule(line).kind).toBe('custom')
      }
    )

    it('should treat an unknown schedule as custom', () => {
      expect(describeSchedule('once in 30m')).toEqual({
        kind: 'custom',
        time: null,
        weekday: null,
        hours: null,
        minutes: null
      })
    })

    it("should read the engine's stored interval for every 2 hours", () => {
      expect(describeSchedule('every 120m')).toMatchObject({ kind: 'hours', hours: 2 })
    })

    it.each(['every 30m', '*/30 * * * *'])('should read %s as every 30 minutes', (line) => {
      expect(describeSchedule(line)).toMatchObject({ kind: 'custom', minutes: 30 })
    })
  })

  describe('listRoutines', () => {
    it("should list a bot's routines with paused ones", async () => {
      engine.jobs.analyst = [
        {
          job_id: 'a',
          name: 'Monday cash position',
          schedule: '0 8 * * 1',
          prompt: 'x',
          deliver: 'bot-chat',
          enabled: true,
          state: 'scheduled'
        },
        {
          job_id: 'b',
          name: 'Invoice chase',
          schedule: '0 17 * * *',
          prompt: 'y',
          enabled: false,
          state: 'paused'
        }
      ]
      expect(await listRoutines(backend, 'analyst')).toEqual([
        {
          id: 'a',
          name: 'Monday cash position',
          schedule: '0 8 * * 1',
          active: true,
          postsToChat: true
        },
        {
          id: 'b',
          name: 'Invoice chase',
          schedule: '0 17 * * *',
          active: false,
          postsToChat: false
        }
      ])
      expect(engine.cronCalls[0]).toEqual({
        profile: 'analyst',
        params: { action: 'list', include_disabled: true }
      })
    })

    it('should return no routines for a bot without any', async () => {
      expect(await listRoutines(backend, 'analyst')).toEqual([])
    })
  })

  describe('changing routines', () => {
    it('should add a routine that posts to the bot chat', async () => {
      await addRoutine(backend, 'analyst', draft())
      expect(engine.jobs.analyst).toMatchObject([
        {
          name: 'Monday cash position',
          schedule: '0 8 * * 1',
          prompt: 'Summarise the cash position.',
          deliver: 'bot-chat'
        }
      ])
    })

    it('should add a routine that keeps its runs out of the chat', async () => {
      await addRoutine(backend, 'analyst', draft({ postsToChat: false }))
      expect(engine.cronCalls[0].params).not.toHaveProperty('deliver')
    })

    it('should pause and resume a routine', async () => {
      await addRoutine(backend, 'analyst', draft())
      const [routine] = await listRoutines(backend, 'analyst')
      await setRoutineActive(backend, 'analyst', { id: routine.id, active: false })
      expect((await listRoutines(backend, 'analyst'))[0].active).toBe(false)
      await setRoutineActive(backend, 'analyst', { id: routine.id, active: true })
      expect((await listRoutines(backend, 'analyst'))[0].active).toBe(true)
    })

    it('should remove a routine', async () => {
      await addRoutine(backend, 'analyst', draft())
      const [routine] = await listRoutines(backend, 'analyst')
      await removeRoutine(backend, 'analyst', routine.id)
      expect(await listRoutines(backend, 'analyst')).toEqual([])
    })

    it('should report a failure the engine returns inside the result', async () => {
      engine.failCronOnce('bad schedule')
      const adding = addRoutine(backend, 'analyst', draft())
      await expect(adding).rejects.toBeInstanceOf(RosterError)
      await expect(adding).rejects.toMatchObject({
        key: 'routines.errorEngine',
        detail: 'bad schedule'
      })
    })
  })

  describe('an opened routine', () => {
    const cashJob = (patch: Partial<CronJob> = {}): CronJob => ({
      job_id: 'cash',
      name: 'Monday cash position',
      schedule: '0 8 * * 1',
      prompt: 'Summarise the cash position.',
      deliver: 'bot-chat',
      enabled: true,
      state: 'scheduled',
      next_run_at: '2026-11-09T08:00:00+00:00',
      ...patch
    })
    const open = async (patch: Partial<CronJob> = {}): Promise<RoutineDetails> => {
      engine.jobs.analyst = [cashJob(patch)]
      return loadRoutine(backend, 'analyst', 'cash')
    }

    it('should load its full instruction, schedule and next run', async () => {
      expect(await open()).toEqual({
        id: 'cash',
        draft: draft(),
        active: true,
        nextRunAt: '2026-11-09T08:00:00+00:00',
        lastRunAt: null,
        lastStatus: null,
        lastError: null
      })
    })

    it('should show the last run of a routine that failed, with its error', async () => {
      const details = await open({
        last_run_at: '2026-11-06T08:00:00+00:00',
        last_status: 'error',
        last_error: 'Model quota exhausted'
      })
      expect(details).toMatchObject({
        lastRunAt: '2026-11-06T08:00:00+00:00',
        lastStatus: 'error',
        lastError: 'Model quota exhausted'
      })
    })

    it('should keep a schedule the form cannot show as its own line', async () => {
      const { draft: loaded } = await open({ schedule: '15 */3 * * 1-5' })
      expect(loaded.schedule).toMatchObject({ kind: 'custom', custom: '15 */3 * * 1-5' })
    })

    it('should read every 2 hours back as the hours kind', async () => {
      const { draft: loaded } = await open({ schedule: 'every 2h' })
      expect(loaded.schedule).toMatchObject({ kind: 'hours', hours: 2 })
    })

    it('should save an edit and show it in the list', async () => {
      const { draft: before } = await open()
      const after = draft({
        instruction: 'Summarise cash and runway.',
        schedule: schedule({ kind: 'weekdays', time: '07:30' })
      })
      await saveRoutine(backend, 'analyst', { id: 'cash', before, after })
      expect(engine.cronWrites).toEqual([
        {
          method: 'PUT',
          path: '/api/cron/jobs/cash?profile=analyst',
          body: {
            updates: {
              prompt: 'Summarise cash and runway.',
              schedule: '30 7 * * 1-5'
            }
          }
        }
      ])
      expect((await listRoutines(backend, 'analyst'))[0].schedule).toBe('30 7 * * 1-5')
      expect((await loadRoutine(backend, 'analyst', 'cash')).draft.instruction).toBe(
        'Summarise cash and runway.'
      )
    })

    it('should keep a schedule Talyx cannot show when the edit leaves it alone', async () => {
      const { draft: before } = await open({ schedule: '15 */3 * * 1-5' })
      await saveRoutine(backend, 'analyst', {
        id: 'cash',
        before,
        after: { ...before, name: 'Cash, three-hourly' }
      })
      expect(engine.cronWrites[0].body).toEqual({
        updates: { name: 'Cash, three-hourly' }
      })
      expect(engine.jobs.analyst[0].schedule).toBe('15 */3 * * 1-5')
    })

    it('should stop posting to the chat', async () => {
      const { draft: before } = await open()
      await saveRoutine(backend, 'analyst', {
        id: 'cash',
        before,
        after: { ...before, postsToChat: false }
      })
      expect(engine.jobs.analyst[0].deliver).toBe('local')
    })

    it('should report a save the engine refuses, with its reason', async () => {
      const { draft: before } = await open()
      engine.refuseCronOnce("Invalid schedule 'every someday'")
      const saving = saveRoutine(backend, 'analyst', {
        id: 'cash',
        before,
        after: { ...before, schedule: scheduleDraft('every someday') }
      })
      await expect(saving).rejects.toBeInstanceOf(RosterError)
      await expect(saving).rejects.toMatchObject({
        key: 'routines.errorSave',
        detail: "Invalid schedule 'every someday'"
      })
      expect(engine.jobs.analyst[0].schedule).toBe('0 8 * * 1')
    })

    it('should run it now and show the run with its output', async () => {
      await open()
      expect(await listRoutineRuns(backend, 'analyst', 'cash')).toEqual([])
      await runRoutine(backend, 'analyst', 'cash')
      expect(engine.cronWrites[0]).toMatchObject({
        method: 'POST',
        path: '/api/cron/jobs/cash/trigger?profile=analyst'
      })
      const runs = await listRoutineRuns(backend, 'analyst', 'cash')
      expect(runs).toEqual([
        {
          id: 'cash-run',
          sessionId: 'cash-run',
          startedAt: 1_794_045_600,
          state: 'finished',
          reason: '',
          preview: null
        }
      ])
      expect(await openRoutineRun(backend, 'analyst', runs[0])).toEqual({
        output: 'Cash is above the floor.',
        error: null
      })
      expect(await loadRoutine(backend, 'analyst', 'cash')).toMatchObject({
        lastStatus: 'ok',
        lastError: null
      })
    })

    it('should report a run the engine refuses', async () => {
      await open()
      engine.refuseCronOnce('Job is already running or was claimed by another scheduler')
      await expect(runRoutine(backend, 'analyst', 'cash')).rejects.toMatchObject({
        key: 'routines.errorRun'
      })
    })

    it('should list only the five most recent runs', async () => {
      const runs = Array.from({ length: 7 }, (_, index) => ({
        id: `run-${index}`,
        started_at: 1_794_000_000 - index,
        is_active: false,
        end_reason: 'cron_complete',
        title: `Run ${index}`
      }))
      await open({ runs })
      const recent = await listRoutineRuns(backend, 'analyst', 'cash')
      expect(recent.map((run) => run.startedAt)).toEqual([
        1_794_000_000, 1_793_999_999, 1_793_999_998, 1_793_999_997, 1_793_999_996
      ])
    })

    it('should tell a running, a finished and a stopped run apart', async () => {
      await open({
        runs: [
          run({ id: 'a', started_at: 3, is_active: true, end_reason: null }),
          run({ id: 'b', started_at: 2 }),
          run({ id: 'c', started_at: 1, end_reason: 'cron_incomplete_no_output' }),
          // A run that stopped without saying why keeps its session title out of the reason.
          run({ id: 'd', started_at: 0, end_reason: null, title: 'Cash · Nov 12 10:59' })
        ]
      })
      expect(await listRoutineRuns(backend, 'analyst', 'cash')).toEqual([
        { id: 'a', sessionId: 'a', startedAt: 3, state: 'running', reason: '', preview: null },
        { id: 'b', sessionId: 'b', startedAt: 2, state: 'finished', reason: '', preview: null },
        {
          id: 'c',
          sessionId: 'c',
          startedAt: 1,
          state: 'stopped',
          reason: 'cron_incomplete_no_output',
          preview: null
        },
        {
          id: 'd',
          sessionId: 'd',
          startedAt: 0,
          state: 'stopped',
          reason: '',
          preview: null
        }
      ])
    })

    it.each([
      ['COMPLETED · Balance 1200', 'finished', ''],
      ['Balance 1200', 'finished', ''],
      ['FAILED · timeout', 'stopped', 'FAILED · timeout'],
      [
        'CANCELLED · cancelled on request (Stop)',
        'stopped',
        'CANCELLED · cancelled on request (Stop)'
      ],
      ['MISSED · Script-only run', 'stopped', 'MISSED · Script-only run']
    ])('should read a script-only run titled "%s" as %s', async (title, state, reason) => {
      await open({
        runs: [run({ id: 'cron_output:cash:x', end_reason: null, title, source: 'cron_output' })]
      })
      expect(await listRoutineRuns(backend, 'analyst', 'cash')).toMatchObject([
        { sessionId: null, state, reason }
      ])
    })

    describe('opening a run', () => {
      const runOf = async (row: CronRun): Promise<Awaited<ReturnType<typeof openRoutineRun>>> => {
        await open({ runs: [row] })
        const [listed] = await listRoutineRuns(backend, 'analyst', 'cash')
        return openRoutineRun(backend, 'analyst', listed)
      }

      it("should show a finished run's last reply as its output", async () => {
        engine.runMessages.s1 = [
          { role: 'user', content: 'Summarise the cash position.' },
          { role: 'assistant', content: 'Checking the accounts.' },
          { role: 'tool', content: '{"balance": 1200}' },
          { role: 'assistant', content: [{ type: 'text', text: 'Cash is 1,200.' }] }
        ]
        expect(await runOf(run({ id: 's1' }))).toEqual({ output: 'Cash is 1,200.', error: null })
      })

      it('should show why a stopped run stopped, with what it wrote before', async () => {
        engine.runMessages.s2 = [
          { role: 'user', content: 'Summarise the cash position.' },
          { role: 'assistant', content: 'Half a report' }
        ]
        expect(await runOf(run({ id: 's2', end_reason: 'cron_incomplete_no_output' }))).toEqual({
          output: 'Half a report',
          error: 'cron_incomplete_no_output'
        })
      })

      it('should find a reply written before many tool calls', async () => {
        const tools = Array.from({ length: 30 }, () => ({ role: 'tool', content: '{}' }))
        engine.runMessages.s4 = [
          { role: 'user', content: 'Summarise the cash position.' },
          { role: 'assistant', content: 'Cash is 1,200.' },
          ...tools
        ]
        const row = run({ id: 's4', end_reason: 'cron_incomplete_no_output' })
        expect(await runOf(row)).toMatchObject({ output: 'Cash is 1,200.' })
      })

      it('should show no output for a run that wrote no reply', async () => {
        engine.runMessages.s3 = [{ role: 'user', content: 'Summarise the cash position.' }]
        const row = run({ id: 's3', preview: 'Summarise the cash position.', source: 'cron' })
        expect(await runOf(row)).toEqual({ output: null, error: null })
      })

      it("should show a script-only run's output from its row, without a session", async () => {
        const row = run({
          id: 'cron_output:cash:2026-11-12_10-59-14',
          end_reason: null,
          title: 'Script-only run',
          preview: 'Balance 1200',
          source: 'cron_output'
        })
        expect(await runOf(row)).toEqual({ output: 'Balance 1200', error: null })
      })

      it("should show a failed script-only run's error", async () => {
        const row = run({
          id: 'cron_output:cash:exec:0',
          end_reason: null,
          title: 'FAILED · timeout',
          preview: 'timeout',
          source: 'cron_output'
        })
        expect(await runOf(row)).toEqual({ output: 'timeout', error: 'FAILED · timeout' })
      })

      it('should report a run whose session the engine no longer has', async () => {
        await expect(runOf(run({ id: 'gone' }))).rejects.toMatchObject({
          key: 'routines.errorRunOutput'
        })
      })
    })
  })
})

describe('saveRoutine', () => {
  const saved = async (after: RoutineDraft): Promise<RoutineUpdates[]> => {
    const updates: RoutineUpdates[] = []
    await saveRoutine(
      { updateRoutine: async (_profile, _id, change) => void updates.push(change) },
      'analyst',
      { id: 'cash', before: draft(), after }
    )
    return updates
  }

  it('should send only the fields that changed, trimmed', async () => {
    expect(
      await saved(draft({ name: '  Cash  ', instruction: 'Summarise the cash position.' }))
    ).toEqual([{ name: 'Cash' }])
  })

  it('should send a new schedule as its line and a new chat choice', async () => {
    expect(
      await saved(draft({ schedule: schedule({ kind: 'hours', hours: 3 }), postsToChat: false }))
    ).toEqual([{ schedule: 'every 3h', postsToChat: false }])
  })
})
