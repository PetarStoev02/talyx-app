import { ipcMain } from 'electron'
import type { GetConversation } from '../../domain/office/useCases/GetConversation'
import type { SendDirectMessage } from '../../domain/office/useCases/SendDirectMessage'
import type { SendGroupMessage } from '../../domain/office/useCases/SendGroupMessage'
import {
  ConversationTargetSchema,
  SendDmSchema,
  SendGroupSchema,
  validateInput
} from './validation'

export interface ChatIpcDeps {
  conversation: GetConversation
  sendGroup: SendGroupMessage
  sendDm: SendDirectMessage
}

export function registerChatIpc(deps: ChatIpcDeps): void {
  ipcMain.handle('chat:conversation', (_e, target: unknown) =>
    deps.conversation.execute(validateInput(ConversationTargetSchema, target))
  )
  ipcMain.handle('chat:send-group', (_e, input: unknown) =>
    deps.sendGroup.execute(validateInput(SendGroupSchema, input))
  )
  ipcMain.handle('chat:send-dm', (_e, input: unknown) =>
    deps.sendDm.execute(validateInput(SendDmSchema, input))
  )
}
