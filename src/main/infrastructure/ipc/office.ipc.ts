import { ipcMain, shell } from 'electron'
import type { GetOfficeSnapshot } from '../../domain/office/useCases/GetOfficeSnapshot'
import type { GiveTask } from '../../domain/office/useCases/GiveTask'
import type { SendToThread } from '../../domain/office/useCases/SendToThread'
import {
  ExternalUrlSchema,
  GiveTaskSchema,
  ProjectIdSchema,
  SendToThreadSchema,
  validateInput
} from './validation'

export interface OfficeIpcDeps {
  snapshot: GetOfficeSnapshot
  giveTask: GiveTask
  sendToThread: SendToThread
}

export function registerOfficeIpc(deps: OfficeIpcDeps): void {
  ipcMain.handle('office:snapshot', (_e, projectId: unknown) =>
    deps.snapshot.execute(validateInput(ProjectIdSchema.nullable(), projectId))
  )
  ipcMain.handle('office:give-task', (_e, input: unknown) =>
    deps.giveTask.execute(validateInput(GiveTaskSchema, input))
  )
  ipcMain.handle('office:send-to-thread', (_e, input: unknown) =>
    deps.sendToThread.execute(validateInput(SendToThreadSchema, input))
  )
  ipcMain.handle('office:open-external', (_e, url: unknown) =>
    shell.openExternal(validateInput(ExternalUrlSchema, url))
  )
}
