import type { SortMode } from '../../sorting/model/SortMode'

export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly'

export interface ScheduledSort {
  id?: number
  name: string
  sourcePath: string
  outputPath: string
  mode: SortMode
  frequency: ScheduleFrequency
  enabled: boolean
  lastRunAt: string | null
  nextRunAt: string
  createdAt: string
}
