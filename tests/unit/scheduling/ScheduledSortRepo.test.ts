import { describe, it, expect, beforeEach } from 'vitest'
import { createInMemoryDatabase } from '../../../src/main/infrastructure/database'
import {
  ScheduledSortRepo,
  computeNextRun
} from '../../../src/main/domain/scheduling/repository/ScheduledSortRepo'
import type Database from 'better-sqlite3'

describe('ScheduledSortRepo', () => {
  let db: Database.Database
  let repo: ScheduledSortRepo

  beforeEach(() => {
    db = createInMemoryDatabase()
    repo = new ScheduledSortRepo(db)
  })

  it('adds and retrieves a schedule', () => {
    const schedule = repo.add({
      name: 'Daily Downloads',
      sourcePath: '/Users/test/Downloads',
      outputPath: '/Users/test/Sorted',
      mode: 'copy',
      frequency: 'daily',
      enabled: true,
      nextRunAt: '2026-03-14T06:00:00.000Z'
    })

    expect(schedule.id).toBeDefined()
    expect(schedule.name).toBe('Daily Downloads')
    expect(schedule.frequency).toBe('daily')
    expect(schedule.enabled).toBe(true)

    const found = repo.getById(schedule.id!)
    expect(found).not.toBeNull()
    expect(found!.name).toBe('Daily Downloads')
  })

  it('should still list a schedule saved with a template by an older version', () => {
    db.prepare(
      `INSERT INTO scheduled_sorts (name, source_path, output_path, mode, frequency, template_id, deep_analysis, next_run_at, enabled)
       VALUES ('old', '/a', '/b', 'copy', 'daily', 'community-legal', 1, datetime('now'), 1)`
    ).run()
    expect(repo.getAll().map((s) => s.name)).toContain('old')
  })

  it('lists all schedules', () => {
    repo.add({
      name: 'A',
      sourcePath: '/a',
      outputPath: '/b',
      mode: 'copy',
      frequency: 'daily',
      enabled: true,
      nextRunAt: '2026-03-14T06:00:00.000Z'
    })
    repo.add({
      name: 'B',
      sourcePath: '/c',
      outputPath: '/d',
      mode: 'move',
      frequency: 'weekly',
      enabled: false,
      nextRunAt: '2026-03-20T06:00:00.000Z'
    })

    const all = repo.getAll()
    expect(all).toHaveLength(2)
  })

  it('returns only enabled schedules', () => {
    repo.add({
      name: 'Enabled',
      sourcePath: '/a',
      outputPath: '/b',
      mode: 'copy',
      frequency: 'daily',
      enabled: true,
      nextRunAt: '2026-03-14T06:00:00.000Z'
    })
    repo.add({
      name: 'Disabled',
      sourcePath: '/c',
      outputPath: '/d',
      mode: 'copy',
      frequency: 'daily',
      enabled: false,
      nextRunAt: '2026-03-14T06:00:00.000Z'
    })

    const enabled = repo.getEnabled()
    expect(enabled).toHaveLength(1)
    expect(enabled[0].name).toBe('Enabled')
  })

  it('returns due schedules', () => {
    // Due (nextRunAt in the past)
    repo.add({
      name: 'Due',
      sourcePath: '/a',
      outputPath: '/b',
      mode: 'copy',
      frequency: 'daily',
      enabled: true,
      nextRunAt: '2020-01-01T06:00:00.000Z'
    })
    // Not due (nextRunAt in the future)
    repo.add({
      name: 'Not Due',
      sourcePath: '/c',
      outputPath: '/d',
      mode: 'copy',
      frequency: 'daily',
      enabled: true,
      nextRunAt: '2099-01-01T06:00:00.000Z'
    })

    const due = repo.getDue()
    expect(due).toHaveLength(1)
    expect(due[0].name).toBe('Due')
  })

  it('toggles enabled state', () => {
    const schedule = repo.add({
      name: 'Toggle',
      sourcePath: '/a',
      outputPath: '/b',
      mode: 'copy',
      frequency: 'daily',
      enabled: true,
      nextRunAt: '2026-03-14T06:00:00.000Z'
    })

    repo.setEnabled(schedule.id!, false)
    expect(repo.getById(schedule.id!)!.enabled).toBe(false)

    repo.setEnabled(schedule.id!, true)
    expect(repo.getById(schedule.id!)!.enabled).toBe(true)
  })

  it('marks a run and updates nextRunAt', () => {
    const schedule = repo.add({
      name: 'Run',
      sourcePath: '/a',
      outputPath: '/b',
      mode: 'copy',
      frequency: 'daily',
      enabled: true,
      nextRunAt: '2026-03-14T06:00:00.000Z'
    })

    repo.markRun(schedule.id!, '2026-03-15T06:00:00.000Z')
    const updated = repo.getById(schedule.id!)!
    expect(updated.lastRunAt).toBeTruthy()
    expect(updated.nextRunAt).toBe('2026-03-15T06:00:00.000Z')
  })

  it('removes a schedule', () => {
    const schedule = repo.add({
      name: 'Remove',
      sourcePath: '/a',
      outputPath: '/b',
      mode: 'copy',
      frequency: 'daily',
      enabled: true,
      nextRunAt: '2026-03-14T06:00:00.000Z'
    })

    repo.remove(schedule.id!)
    expect(repo.getById(schedule.id!)).toBeNull()
  })
})

describe('computeNextRun', () => {
  it('computes daily next run', () => {
    const from = new Date('2026-03-13T12:00:00Z')
    const next = computeNextRun('daily', from)
    expect(new Date(next).getDate()).toBe(from.getDate() + 1)
  })

  it('computes weekly next run', () => {
    const from = new Date('2026-03-13T12:00:00Z')
    const next = computeNextRun('weekly', from)
    const diff = new Date(next).getTime() - from.getTime()
    // Should be approximately 7 days
    expect(diff).toBeGreaterThan(6 * 24 * 60 * 60_000)
    expect(diff).toBeLessThan(8 * 24 * 60 * 60_000)
  })

  it('computes monthly next run', () => {
    const from = new Date('2026-03-13T12:00:00Z')
    const next = computeNextRun('monthly', from)
    expect(new Date(next).getMonth()).toBe(from.getMonth() + 1)
  })

  it('normalizes to 6:00 AM', () => {
    const from = new Date('2026-03-13T18:30:00Z')
    const next = computeNextRun('daily', from)
    const nextDate = new Date(next)
    expect(nextDate.getHours()).toBe(6)
    expect(nextDate.getMinutes()).toBe(0)
  })
})
