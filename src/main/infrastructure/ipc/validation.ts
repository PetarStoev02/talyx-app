import { z } from 'zod/v4'
import { resolve, isAbsolute } from 'path'
import { KOKORO_VOICES, type KokoroVoice } from '../../domain/ai/voicePresets'

// --- Primitives ---

export const absolutePath = z
  .string()
  .refine((p) => isAbsolute(p), { message: 'Path must be absolute' })

const sortMode = z.enum(['copy', 'move'])

// --- File entry ---

export const FileEntrySchema = z.object({
  name: z.string().min(1),
  path: absolutePath,
  extension: z.string(),
  size: z.number().nonnegative()
})

// --- Sort ---

export const SortExecuteParamsSchema = z.object({
  files: z.array(
    z.object({
      path: absolutePath,
      name: z.string().min(1),
      size: z.number().nonnegative(),
      classification: z.object({
        category: z.string(),
        subcategory: z.string().nullable(),
        confidence: z.number(),
        metadata: z.record(z.string(), z.unknown()),
        semanticPath: z.array(z.string()).optional(),
        suggestedName: z.string().nullable().optional(),
        entities: z
          .object({
            dates: z.array(z.string()),
            names: z.array(z.string()),
            amounts: z.array(z.string()),
            organizations: z.array(z.string())
          })
          .optional()
      })
    })
  ),
  outputDir: absolutePath,
  mode: sortMode,
  approvedRenames: z.record(z.string(), z.string()).optional()
})

export const SortHistoryParamsSchema = z.object({
  limit: z.number().int().positive().max(1000),
  offset: z.number().int().nonnegative()
})

// --- Watch ---

export const WatchAddParamsSchema = z.object({
  path: absolutePath,
  outputPath: absolutePath,
  sortMode
})

export const WatchToggleParamsSchema = z.object({
  id: z.number().int().positive(),
  enabled: z.boolean()
})

// --- Voice ---

export const VoiceTranscribeSchema = z.object({
  // 60 s of 16 kHz 16-bit mono is ~2.6 MB of base64; 20 MB bounds a ~8 minute utterance.
  wavBase64: z.string().min(64).max(20_000_000)
})

export const VoiceModelChoiceSchema = z.object({
  choice: z.enum(['fast', 'accurate'])
})

export const KokoroVoiceSchema = z.object({
  voice: z.enum(KOKORO_VOICES.map((v) => v.id) as [KokoroVoice, ...KokoroVoice[]])
})

// --- Settings ---

const classificationRuleSchema = z.object({
  extension: z.string().min(1).max(20),
  category: z.string().min(1).max(100),
  subcategory: z.string().max(100).nullable()
})

const sortPresetSchema = z.object({
  name: z.string().min(1).max(200),
  sourcePath: absolutePath,
  outputPath: absolutePath,
  mode: sortMode
})

/** 24-hour clock, zero-padded — what an <input type="time"> produces. */
const BRIEFING_TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export const UserSettingsPartialSchema = z
  .object({
    defaultSortMode: sortMode,
    defaultOutputDir: absolutePath.nullable(),
    theme: z.enum(['light', 'dark', 'system']),
    hasSeenOnboarding: z.boolean(),
    hasSeenTour: z.boolean(),
    hasCompletedFirstSort: z.boolean(),
    classificationRules: z.array(classificationRuleSchema).max(500),
    sortPresets: z.array(sortPresetSchema).max(50),
    sorterSource: z.enum(['smart-local', 'claude']),
    appLanguage: z.string().min(2).max(10),
    updateFrequency: z.enum(['daily', 'weekly', 'manual']),
    assistantHotkeyEnabled: z.boolean(),
    projectsRoot: z.string().nullable(),
    assistantModel: z.string().min(1).max(100),
    assistantProvider: z.enum(['api-key', 'claude-code']),
    claudeCodePath: absolutePath.nullable(),
    sidebarCollapsed: z.boolean(),
    filesGroupOpen: z.boolean(),
    voiceEnabled: z.boolean(),
    voiceHotkey: z.enum(['Alt+Space', 'Control+Space', 'Shift+Space']),
    voiceSttModel: z.enum(['fast', 'accurate']),
    voiceSpeakReplies: z.boolean(),
    voiceMode: z.boolean(),
    voiceTtsEngine: z.enum(['kokoro', 'system']),
    voiceTtsVoice: z.enum(KOKORO_VOICES.map((v) => v.id) as [KokoroVoice, ...KokoroVoice[]]),
    noticesEnabled: z.boolean(),
    briefingTime: z.string().regex(BRIEFING_TIME, 'A briefing time must look like 08:00'),
    briefingStyle: z.enum(['facts', 'written']),
    noticesPermissionAsked: z.boolean(),
    noticeKinds: z.object({
      briefing: z.boolean(),
      disk: z.boolean(),
      meeting: z.boolean(),
      agenda: z.boolean(),
      clutter: z.boolean()
    }),
    /** The instant notices resume: end of today from ⌘⇧Esc, end of the meeting from focus. */
    noticesPausedUntil: z.iso.datetime({ offset: true }).nullable()
    // noticeMarks is deliberately absent: what Talyx has already said is its own
    // record, not something the window is allowed to rewrite.
  })
  .partial()

// --- Helpers ---

export function validateInput<T>(schema: z.ZodType<T>, data: unknown): T {
  return schema.parse(data)
}

/** Check that a resolved path is contained within a parent directory. */
export function isPathContained(childPath: string, parentDir: string): boolean {
  const resolvedChild = resolve(childPath)
  const resolvedParent = resolve(parentDir)
  return resolvedChild.startsWith(resolvedParent + '/')
}
