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
