import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync, symlinkSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SchedulerService } from '../../../src/main/domain/scheduling/services/SchedulerService'
import type { ScheduleEvent } from '../../../src/main/domain/scheduling/services/SchedulerService'
import type { ScheduledSortRepo } from '../../../src/main/domain/scheduling/repository/ScheduledSortRepo'
import type { ClassificationPipeline } from '../../../src/main/domain/classification/services/ClassificationPipeline'
import type { SortExecutor } from '../../../src/main/domain/sorting/services/SortExecutor'
import type { ScheduledSort } from '../../../src/main/domain/scheduling/model/ScheduledSort'

function scheduleFor(sourcePath: string): ScheduledSort {
  return {
    id: 1,
    name: 'Downloads',
    sourcePath,
    outputPath: '/out',
    mode: 'copy',
    frequency: 'daily',
    enabled: true,
    lastRunAt: null,
    nextRunAt: '2026-01-01T06:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z'
  }
}

describe('SchedulerService', () => {
  let dir: string
  let events: ScheduleEvent[]
  let executeBatch: ReturnType<typeof vi.fn>
  let service: SchedulerService

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'talyx-scheduler-'))
    events = []
    executeBatch = vi.fn().mockResolvedValue(undefined)
    const repo = { markRun: vi.fn() } as unknown as ScheduledSortRepo
    const pipeline = {
      classify: vi.fn().mockResolvedValue({ category: 'Documents', subcategory: null })
    } as unknown as ClassificationPipeline
    const executor = { executeBatch } as unknown as SortExecutor
    service = new SchedulerService(repo, pipeline, executor, (event) => events.push(event))
  })

  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('should sort only the loose, visible, non-symlink files at the root of the source folder', async () => {
    writeFileSync(join(dir, 'a.pdf'), 'a')
    writeFileSync(join(dir, '.hidden'), 'h')
    mkdirSync(join(dir, 'sub'))
    writeFileSync(join(dir, 'sub', 'b.pdf'), 'b')
    symlinkSync(join(dir, 'a.pdf'), join(dir, 'link.pdf'))

    await service.runSchedule(scheduleFor(dir))

    const sorted = executeBatch.mock.calls[0][0] as Array<{ name: string }>
    expect(sorted.map((f) => f.name)).toEqual(['a.pdf'])
    expect(events).toEqual([
      { type: 'sort-completed', scheduleId: 1, scheduleName: 'Downloads', fileCount: 1 }
    ])
  })

  it('should report a failed sort when the source folder does not exist', async () => {
    await service.runSchedule(scheduleFor(join(dir, 'missing')))

    expect(executeBatch).not.toHaveBeenCalled()
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ type: 'sort-failed', scheduleId: 1 })
  })

  it('should report a failed sort when the source path is a file, not a folder', async () => {
    const file = join(dir, 'not-a-folder.txt')
    writeFileSync(file, 'x')

    await service.runSchedule(scheduleFor(file))

    expect(executeBatch).not.toHaveBeenCalled()
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ type: 'sort-failed', scheduleId: 1 })
  })
})
