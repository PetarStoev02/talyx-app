import { z } from 'zod/v4'

export const UserSettingsPartialSchema = z
  .object({
    theme: z.literal('dark'),
    currentProjectId: z.string().min(1).nullable(),
    staleMinutes: z.number().int().min(1).max(1440),
    launchAtLogin: z.boolean(),
    funnelEnabled: z.boolean()
  })
  .partial()

export function validateInput<T>(schema: z.ZodType<T>, data: unknown): T {
  return schema.parse(data)
}

const id = z.string().trim().min(1).max(200)
const name = z.string().trim().min(1).max(100)
const httpsUrl = z.url({ protocol: /^https$/ }).max(2000)

export const ProjectIdSchema = id
export const BotIdSchema = id

export const ProjectSchema = z.object({
  id,
  name,
  logoPath: z.string().max(4096).nullable(),
  windowView: z.enum(['none', 'city', 'fields'])
})

export const GroupSchema = z.object({ id, projectId: id, name })

export const RoomSchema = z.object({
  id,
  projectId: id,
  name,
  kind: z.enum(['conference', 'work', 'chill']),
  groupId: id.nullable()
})

export const BotSchema = z.object({
  id,
  projectId: id,
  name,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  groupIds: z.array(id).max(50),
  webhookUrl: httpsUrl.nullable(),
  t3ProjectIds: z.array(id).max(50),
  grokLink: httpsUrl.nullable()
})

export const WebhookKeySchema = z.object({ botId: id, key: z.string().min(1).max(4096) })

export const FunnelSchema = z.enum(['on', 'off'])

export const GiveTaskSchema = z.object({
  botId: id,
  task: z.string().min(1).max(2000),
  target: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('webhook') }),
    z.object({ kind: z.literal('t3'), t3ProjectId: id })
  ])
})

export const SendToThreadSchema = z.object({ threadId: id, message: z.string().min(1).max(10_000) })

export const ExternalUrlSchema = z
  .string()
  .max(2000)
  .refine(
    (url) => url.startsWith('http://127.0.0.1:3773/') || URL.parse(url)?.protocol === 'https:',
    'only T3 and https links open'
  )
