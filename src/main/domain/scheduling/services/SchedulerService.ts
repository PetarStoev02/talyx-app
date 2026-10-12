import { readdir } from 'fs/promises'
import type { ScheduledSortRepo } from '../repository/ScheduledSortRepo'
import { computeNextRun } from '../repository/ScheduledSortRepo'
import type { ClassificationPipeline } from '../../classification/services/ClassificationPipeline'
import type { SortExecutor, ClassifiedFile } from '../../sorting/services/SortExecutor'
import { scanForSort } from '../../shared/scanForSort'
import type { ScheduledSort } from '../model/ScheduledSort'

export interface ScheduleEvent {
  type: 'sort-completed' | 'sort-failed'
  scheduleId: number
  scheduleName: string
  fileCount?: number
  error?: string
}

/** Interval between checks for due schedules (60 seconds). */
const CHECK_INTERVAL_MS = 60_000

export class SchedulerService {
  private timer: ReturnType<typeof setInterval> | null = null
  private running = new Set<number>()

  constructor(
    private repo: ScheduledSortRepo,
    private pipeline: ClassificationPipeline,
    private executor: SortExecutor,
    private onEvent?: (event: ScheduleEvent) => void
  ) {}

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => this.checkDue(), CHECK_INTERVAL_MS)
    // Run an immediate check on start
    this.checkDue()
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  async checkDue(): Promise<void> {
    const due = this.repo.getDue()
    for (const schedule of due) {
      if (schedule.id && !this.running.has(schedule.id)) {
        this.runSchedule(schedule)
      }
    }
  }

  async runSchedule(schedule: ScheduledSort): Promise<void> {
    if (!schedule.id) return
    this.running.add(schedule.id)

    try {
      // 1. Scan source folder. scanForSort reports an unreadable folder as empty, so
      // probe it first: a missing, denied or non-directory source must fail the run.
      await readdir(schedule.sourcePath)
      const { files } = await scanForSort(schedule.sourcePath)
      if (files.length === 0) {
        this.advanceSchedule(schedule)
        return
      }

      // 2. Classify files
      const classified: ClassifiedFile[] = []
      for (const file of files) {
        const result = await this.pipeline.classify(file.path)
        classified.push({
          path: file.path,
          name: file.name,
          size: file.size,
          classification: result
        })
      }

      // 3. Execute sort
      await this.executor.executeBatch(classified, schedule.outputPath, schedule.mode)

      // 4. Advance schedule
      this.advanceSchedule(schedule)

      this.onEvent?.({
        type: 'sort-completed',
        scheduleId: schedule.id,
        scheduleName: schedule.name,
        fileCount: classified.length
      })
    } catch (err) {
      this.onEvent?.({
        type: 'sort-failed',
        scheduleId: schedule.id!,
        scheduleName: schedule.name,
        error: err instanceof Error ? err.message : String(err)
      })
      // Still advance the schedule so it doesn't get stuck
      this.advanceSchedule(schedule)
    } finally {
      this.running.delete(schedule.id)
    }
  }

  private advanceSchedule(schedule: ScheduledSort): void {
    if (!schedule.id) return
    const nextRun = computeNextRun(schedule.frequency)
    this.repo.markRun(schedule.id, nextRun)
  }
}
