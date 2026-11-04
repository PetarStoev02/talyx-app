import { isAbsolute } from 'path'
import { z } from 'zod/v4'

export const UserSettingsPartialSchema = z
  .object({
    theme: z.enum(['light', 'dark', 'system']),
    sidebarCollapsed: z.boolean()
  })
  .partial()

/** Talyx runs this file, so it is never set through `settings:set` (page code could name any
 *  binary): only the native file chooser behind `engine:pick-path` writes it. */
export const EnginePathSchema = z.string().refine(isAbsolute, 'enginePath must be an absolute path')

/** A profile name as the engine accepts it. */
export const ProfileNameSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)

/** Chosen by the renderer before it opens the socket, so early frames find it. */
export const EngineSocketIdSchema = z.string().regex(/^[A-Za-z0-9-]{8,64}$/)

export const EngineSocketTextSchema = z.string().max(16 * 1024 * 1024)

export const EngineHttpRequestSchema = z.object({
  // A gateway API path only. engine.ts also checks the resolved path, which this regex cannot see.
  path: z.string().regex(/^\/api\/[^\s]*$/),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
  body: z.unknown().optional(),
  profile: ProfileNameSchema.nullable().optional(),
  timeoutMs: z.number().int().positive().max(1_800_000).optional()
})

export function validateInput<T>(schema: z.ZodType<T>, input: unknown): T {
  return schema.parse(input)
}
