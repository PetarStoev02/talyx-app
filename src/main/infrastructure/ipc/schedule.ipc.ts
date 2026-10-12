import { ipcMain } from 'electron'
import { z } from 'zod/v4'
import { resolve, normalize } from 'path'
import type { ScheduledSortRepo } from '../../domain/scheduling/repository/ScheduledSortRepo'
import { computeNextRun } from '../../domain/scheduling/repository/ScheduledSortRepo'
import type { SchedulerService } from '../../domain/scheduling/services/SchedulerService'
import { validateInput } from './validation'

const absolutePath = z.string().refine(
  (p) => {
    const normalized = normalize(p)
    return normalized === resolve(normalized)
  },
  { message: 'Path must be absolute' }
)

const CreateScheduleSchema = z.object({
  name: z.string().min(1).max(200),
  sourcePath: absolutePath,
  outputPath: absolutePath,
  mode: z.enum(['copy', 'move']),
  frequency: z.enum(['daily', 'weekly', 'monthly'])
})

const ToggleScheduleSchema = z.object({
  id: z.number().int().positive(),
  enabled: z.boolean()
})

export function registerScheduleIpc(repo: ScheduledSortRepo, service: SchedulerService): void {
  ipcMain.handle('schedule:list', () => {
    return repo.getAll()
  })

  ipcMain.handle('schedule:create', (_event, rawParams: unknown) => {
    const params = validateInput(CreateScheduleSchema, rawParams)
    const nextRunAt = computeNextRun(params.frequency)
    const schedule = repo.add({
      ...params,
      enabled: true,
      nextRunAt
    })
    return schedule
  })

  ipcMain.handle('schedule:toggle', (_event, rawParams: unknown) => {
    const { id, enabled } = validateInput(ToggleScheduleSchema, rawParams)
    repo.setEnabled(id, enabled)
  })

  ipcMain.handle('schedule:remove', (_event, rawId: unknown) => {
    const id = validateInput(z.number().int().positive(), rawId)
    repo.remove(id)
  })

  ipcMain.handle('schedule:run-now', async (_event, rawId: unknown) => {
    const id = validateInput(z.number().int().positive(), rawId)
    const schedule = repo.getById(id)
    if (!schedule) throw new Error('Schedule not found')
    await service.runSchedule(schedule)
  })
}
