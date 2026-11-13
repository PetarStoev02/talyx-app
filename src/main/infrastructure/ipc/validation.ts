import { isAbsolute } from 'path'
import { z } from 'zod/v4'
import { KEPT_FILE_MAX_BYTES } from '../../../shared/keptFiles'
import { SIDEBAR_WIDTH } from '../../../shared/sidebar'

/** A bot (profile name) or room (room id) to open again on launch. */
export const LastSelectionSchema = z.object({
  kind: z.enum(['bot', 'room']),
  id: z.string().min(1).max(200)
})

export const ThemeSchema = z.enum(['light', 'dark', 'system'])
export type Theme = z.infer<typeof ThemeSchema>

export const UserSettingsPartialSchema = z
  .object({
    lastSelection: LastSelectionSchema.nullable(),
    theme: ThemeSchema,
    setupDone: z.boolean(),
    launchAtLogin: z.boolean(),
    completionSound: z.boolean(),
    sidebarWidth: z.number().int().min(SIDEBAR_WIDTH.min).max(SIDEBAR_WIDTH.max)
  })
  .partial()

/** Talyx runs this file, so it is never set through `settings:set` (page code could name any
 *  binary): only the native file chooser behind `engine:pick-path` and `engine:use-installed`
 *  (the user bin's engine, no argument) write it. */
export const EnginePathSchema = z.string().refine(isAbsolute, 'enginePath must be an absolute path')

/** The engine as a page reports it for diagnostics ("0.22.7", "error (0.22.7)", "not found"). */
export const EngineLabelSchema = z.string().max(200)

/** A renderer failure for the log file; capped so a page cannot flood it. */
export const RendererErrorSchema = z.object({
  scope: z.string().max(100),
  message: z.string().max(8000)
})

// Base64 takes 4 characters for every 3 bytes; the rest is room for the `data:<mime>;base64,` head.
const KEPT_FILE_MAX_CHARS = Math.ceil(KEPT_FILE_MAX_BYTES / 3) * 4 + 1024

/** A file the page could not name a path for, to keep a copy of (files.ipc.ts). */
export const KeptFileSchema = z.object({
  name: z.string().max(255),
  dataUrl: z.string().max(KEPT_FILE_MAX_CHARS)
})

/** A profile name as the engine accepts it. */
export const ProfileNameSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)

/** A room's new bots, as the page sends them: two to six of this machine's profiles. */
export const RoomMembersSchema = z.object({
  roomId: z.string().min(1).max(200),
  members: z
    .array(
      z.object({
        member_id: ProfileNameSchema,
        profile: ProfileNameSchema,
        handle: ProfileNameSchema,
        display_name: z.string().min(1).max(200),
        target: z.object({ kind: z.literal('local'), profile: ProfileNameSchema })
      })
    )
    .min(2)
    .max(6)
})

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

/** A pasted license key; the signature check decides whether it is one. */
export const LicenseKeyInputSchema = z.string().min(1).max(2000)

/** An action a module's main side registered with `ctx.handle`. */
export const ModuleActionSchema = z.string().regex(/^[a-z][a-zA-Z0-9-]{0,63}$/)

export function validateInput<T>(schema: z.ZodType<T>, input: unknown): T {
  return schema.parse(input)
}
