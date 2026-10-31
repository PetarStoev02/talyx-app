import { ipcMain } from 'electron'
import type { z } from 'zod/v4'
import type { RosterRepo } from '../../domain/office/repository/RosterRepo'
import type { SecretStore } from '../office/SecretStore'
import type { FunnelStatus } from '../office/FunnelControl'
import { UnknownBotError } from '../../domain/office/errors'
import { INBOUND_TOKEN, rotateInboundToken } from '../office/inboundToken'
import {
  BotIdSchema,
  BotSchema,
  FunnelSchema,
  GroupSchema,
  ProjectSchema,
  RoomSchema,
  WebhookKeySchema,
  validateInput
} from './validation'

const TOKEN_HINT_CHARS = 4

export interface RosterIpcDeps {
  roster: RosterRepo
  secrets: SecretStore
  funnel: { status: () => FunnelStatus; set: (on: boolean) => Promise<void> }
  /** Something the office shows changed: push a fresh snapshot. */
  changed: () => void
}

// Webhook keys are write-only here: no channel ever returns one.
export function registerRosterIpc({ roster, secrets, funnel, changed }: RosterIpcDeps): void {
  const handleSave = <T>(channel: string, schema: z.ZodType<T>, save: (v: T) => void): void => {
    ipcMain.handle(channel, (_e, raw: unknown) => {
      save(validateInput(schema, raw))
      changed()
    })
  }
  handleSave('roster:save-project', ProjectSchema, (p) => roster.saveProject(p))
  handleSave('roster:save-group', GroupSchema, (g) => roster.saveGroup(g))
  handleSave('roster:save-room', RoomSchema, (room) => roster.saveRoom(room))
  handleSave('roster:save-bot', BotSchema, (b) => roster.saveBot(b))
  handleSave('roster:delete-bot', BotIdSchema, (id) => {
    roster.deleteBot(id)
    secrets.delete(`webhook-key:${id}`)
  })
  handleSave('roster:set-webhook-key', WebhookKeySchema, ({ botId, key }) => {
    if (!roster.allBots().some((b) => b.id === botId)) throw new UnknownBotError(botId)
    secrets.set(`webhook-key:${botId}`, key)
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
