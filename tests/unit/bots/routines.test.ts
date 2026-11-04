import { beforeEach, describe, expect, it } from 'vitest'
import type { RosterBackend } from '../../../src/renderer/src/features/bots/data'
import {
  DEFAULT_SCHEDULE,
  addRoutine,
  composeSchedule,
  describeSchedule,
  listRoutines,
  removeRoutine,
  setRoutineActive
} from '../../../src/renderer/src/features/bots/routines'
import type { RoutineDraft, ScheduleDraft } from '../../../src/renderer/src/features/bots/routines'
import { RosterError } from '../../../src/renderer/src/features/bots/roster'
import { backendFor, engineDouble } from './engineDouble'
import type { EngineDouble } from './engineDouble'

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

    it('should treat an unknown schedule as custom', () => {
      expect(describeSchedule('once in 30m')).toEqual({
        kind: 'custom',
        time: null,
        weekday: null,
        hours: null
      })
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
})
