import { z } from 'zod/v4'

export const UserSettingsPartialSchema = z
  .object({
    theme: z.enum(['light', 'dark', 'system']),
    sidebarCollapsed: z.boolean()
  })
  .partial()

export function validateInput<T>(schema: z.ZodType<T>, input: unknown): T {
  return schema.parse(input)
}
