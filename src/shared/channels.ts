// Every IPC channel between the page and main, in one table: what each invoke takes and answers,
// and what each event carries. `buildApi` (api.ts) calls through it and main registers handlers
// through it (`handle` in ipc/handle.ts), so a handler that answers another type, or a call
// that sends another input, does not compile. The inputs are the zod schemas main validates with:
// types never replace that check, since any page script can send anything.
import { z } from 'zod/v4'
import {
  ENGINE_SOCKET_TEXT_MAX,
  type EngineStatus,
  type MembersChange,
  type UsageDays
} from './engine'
import { KEPT_FILE_MAX_BYTES } from './keptFiles'
import type { McpCall, McpConnection } from './mcp'
import type { ActivationRequest, AvailableModule, ModulesState } from './modules'
import type { PageSettings } from './settings'
import type { InstallExit, InstallSteps } from './setup'
import { SIDEBAR_WIDTH } from './sidebar'
import type { UpdateCheck, UpdateState } from './updater'

/** A bot (profile name) or room (room id) to open again on launch. */
export const LastSelectionSchema = z.object({
  kind: z.enum(['bot', 'room']),
  id: z.string().min(1).max(200)
})

export const ThemeSchema = z.enum(['light', 'dark', 'system'])
export type Theme = z.infer<typeof ThemeSchema>

// exactOptional: a key sent as undefined is refused, not saved over the stored value.
export const UserSettingsPartialSchema = z.object({
  lastSelection: LastSelectionSchema.nullable().exactOptional(),
  theme: ThemeSchema.exactOptional(),
  setupDone: z.boolean().exactOptional(),
  launchAtLogin: z.boolean().exactOptional(),
  completionSound: z.boolean().exactOptional(),
  sidebarWidth: z.number().int().min(SIDEBAR_WIDTH.min).max(SIDEBAR_WIDTH.max).exactOptional()
})
export type SettingsChange = z.infer<typeof UserSettingsPartialSchema>

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

// eslint-disable-next-line no-control-regex
const ConfigKeyPartSchema = z.string().regex(/^(?! )[^\x00-\x1f\x7f\\]{1,200}(?<! )$/)

/**
 * One model off a bot's custom endpoint. Both become parts of one engine config key, passed as one
 * argument (no shell): they may hold spaces (`Go reasoning`, a hand-written endpoint key), but no
 * control character, no backslash (the engine reads it as an escape) and no space at either end.
 */
export const EndpointModelRemovalSchema = z.object({
  profile: ProfileNameSchema,
  endpoint: ConfigKeyPartSchema,
  model: ConfigKeyPartSchema
})

/** The bots and the period the Usage page reads days for; the engine keeps a year at most. */
export const UsageDaysSchema = z.object({
  profiles: z.array(ProfileNameSchema).max(500),
  days: z.number().int().min(1).max(365)
})

/** Chosen by the renderer before it opens the socket, so early frames find it. */
export const EngineSocketIdSchema = z.string().regex(/^[A-Za-z0-9-]{8,64}$/)

export const EngineSocketTextSchema = z.string().max(ENGINE_SOCKET_TEXT_MAX)

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

export const McpCallIdSchema = z.string().uuid()

export const McpAnswerSchema = z.object({ ok: z.boolean(), text: z.string().max(1024 * 1024) })

type In<S extends z.ZodType> = z.infer<S>

/**
 * A module id, checked in main by `ModuleIdSchema` (modules/signing.ts). That schema stays beside
 * the signature checks so the modules repo can import them from plain Node; its type is `string`.
 */
type ModuleId = string

/** Each invoke: the arguments the page sends, and what main's handler answers. */
export interface InvokeChannels {
  'settings:get': { input: []; output: PageSettings }
  'settings:set': { input: [change: SettingsChange]; output: PageSettings }
  'theme:set-native': { input: [theme: Theme]; output: void }

  'engine:status': { input: []; output: EngineStatus }
  'engine:pick-path': { input: []; output: EngineStatus }
  'engine:use-installed': { input: []; output: EngineStatus }
  'engine:http': { input: [request: In<typeof EngineHttpRequestSchema>]; output: unknown }
  'engine:room-members': { input: [change: In<typeof RoomMembersSchema>]; output: MembersChange }
  'engine:endpoint-model-remove': {
    input: [removal: In<typeof EndpointModelRemovalSchema>]
    output: void
  }
  'engine:usage-days': { input: [request: In<typeof UsageDaysSchema>]; output: UsageDays }
  'engine:socket-open': {
    input: [id: In<typeof EngineSocketIdSchema>, profile: In<typeof ProfileNameSchema>]
    output: void
  }
  'engine:socket-send': {
    input: [id: In<typeof EngineSocketIdSchema>, text: In<typeof EngineSocketTextSchema>]
    output: void
  }
  'engine:socket-close': { input: [id: In<typeof EngineSocketIdSchema>]; output: void }

  'setup:install-steps': { input: []; output: InstallSteps }
  'setup:install-run': { input: []; output: void }
  'setup:install-cancel': { input: []; output: void }

  'log:error': { input: [report: In<typeof RendererErrorSchema>]; output: void }

  'app:version': { input: []; output: string }
  'app:diagnostics': { input: [engine: In<typeof EngineLabelSchema>]; output: string }

  'files:keep': { input: [file: In<typeof KeptFileSchema>]; output: string }

  'updater:status': { input: []; output: UpdateState }
  'updater:check': { input: []; output: UpdateCheck }
  'updater:download': { input: []; output: void }
  'updater:cancel': { input: []; output: void }
  'updater:install': { input: []; output: void }

  'modules:state': { input: []; output: ModulesState }
  'modules:take-activation': { input: []; output: ActivationRequest | null }
  'modules:activate': { input: [key: In<typeof LicenseKeyInputSchema>]; output: ModulesState }
  'modules:deactivate': { input: []; output: ModulesState }
  'modules:available': { input: []; output: AvailableModule[] }
  'modules:install': { input: [id: ModuleId]; output: ModulesState }
  'modules:uninstall': { input: [id: ModuleId]; output: ModulesState }
  // The module's own action input: its main side validates it.
  'modules:invoke': {
    input: [id: ModuleId, action: In<typeof ModuleActionSchema>, input: unknown]
    output: unknown
  }

  'mcp:attach': { input: []; output: void }
  'mcp:answer': {
    input: [id: In<typeof McpCallIdSchema>, answer: In<typeof McpAnswerSchema>]
    output: void
  }
  'mcp:connection': { input: []; output: McpConnection }
}

/** Each event main sends the page: the arguments it carries. */
export interface EventChannels {
  'engine:socket-frame': [id: string, text: string]
  'engine:socket-closed': [id: string, code: number, reason: string]
  'setup:install-output': [index: number, text: string]
  'setup:install-exit': [exit: InstallExit]
  'updater:state': [state: UpdateState]
  'modules:state': [state: ModulesState]
  'modules:activation-requested': []
  'mcp:call': [call: McpCall]
  // The splash window's own preload (src/splash/preload.ts), not window.api.
  'splash:version': [version: string]
  'splash:status': [status: string]
}

export type InvokeChannel = keyof InvokeChannels
export type InvokeInput<C extends InvokeChannel> = InvokeChannels[C]['input']
export type InvokeOutput<C extends InvokeChannel> = InvokeChannels[C]['output']
export type EventChannel = keyof EventChannels
