import { dialog, ipcMain } from 'electron'
import type { z } from 'zod/v4'
import type { RosterRepo } from '../../domain/office/repository/RosterRepo'
import type { CreateProject } from '../../domain/office/useCases/CreateProject'
import type { SaveGroup } from '../../domain/office/useCases/SaveGroup'
import type { DeleteBot } from '../../domain/office/useCases/DeleteBot'
import type { SetWebhookKey } from '../../domain/office/useCases/SetWebhookKey'
import type { GetBotInstructions } from '../../domain/office/useCases/GetBotInstructions'
import type { SecretStore } from '../office/SecretStore'
import type { FunnelStatus } from '../office/FunnelControl'
import type { T3Projects } from '../office/T3Projects'
import { INBOUND_TOKEN, rotateInboundToken } from '../office/inboundToken'
import {
  BotIdSchema,
  BotInstructionsSchema,
  BotSchema,
  FunnelSchema,
  GroupSchema,
  ProjectSchema,
  RoomSchema,
  WebhookKeySchema,
  validateInput
} from './validation'

const TOKEN_HINT_CHARS = 4
const LOGO_EXTENSIONS = ['png', 'jpg', 'jpeg', 'svg']

export interface RosterIpcDeps {
  roster: RosterRepo
  createProject: CreateProject
  saveGroup: SaveGroup
  deleteBot: DeleteBot
  setWebhookKey: SetWebhookKey
  botInstructions: GetBotInstructions
  t3Projects: T3Projects
  secrets: SecretStore
  funnel: { status: () => FunnelStatus; set: (on: boolean) => Promise<void> }
  /** Something the office shows changed: push a fresh snapshot. */
  changed: () => void
}

// Webhook keys are write-only here: no channel ever returns one.
export function registerRosterIpc(deps: RosterIpcDeps): void {
  const { roster, secrets, funnel, changed } = deps
  const handleSave = <T>(channel: string, schema: z.ZodType<T>, save: (v: T) => void): void => {
    ipcMain.handle(channel, (_e, raw: unknown) => {
      save(validateInput(schema, raw))
      changed()
    })
  }
  handleSave('roster:save-project', ProjectSchema, (p) => deps.createProject.execute(p))
  handleSave('roster:save-group', GroupSchema, (g) => deps.saveGroup.execute(g))
  handleSave('roster:save-room', RoomSchema, (room) => roster.saveRoom(room))
  handleSave('roster:save-bot', BotSchema, (b) => roster.saveBot(b))
  handleSave('roster:delete-bot', BotIdSchema, (id) => deps.deleteBot.execute(id))
  handleSave('roster:set-webhook-key', WebhookKeySchema, (input) =>
    deps.setWebhookKey.execute(input)
  )

  ipcMain.handle('roster:t3-projects', () => deps.t3Projects.list())
  ipcMain.handle('roster:bot-instructions', (_e, raw: unknown) =>
    deps.botInstructions.execute(validateInput(BotInstructionsSchema, raw))
  )
  ipcMain.handle('roster:pick-logo', async () => {
    const picked = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Logo', extensions: LOGO_EXTENSIONS }]
    })
    return picked.canceled ? null : (picked.filePaths[0] ?? null)
  })

  ipcMain.handle('roster:endpoint', () => ({
    url: funnel.status().url,
    tokenHint: (secrets.get(INBOUND_TOKEN) ?? '').slice(-TOKEN_HINT_CHARS)
  }))
  ipcMain.handle('roster:reveal-token', () => secrets.get(INBOUND_TOKEN))
  ipcMain.handle('roster:rotate-token', () => rotateInboundToken(secrets))
  ipcMain.handle('roster:funnel', (_e, raw: unknown) =>
    funnel.set(validateInput(FunnelSchema, raw) === 'on')
  )
}
