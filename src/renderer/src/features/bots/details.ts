import { z } from 'zod'
import { saveBotMeta } from './data'
import type { RosterBackend } from './data'
import { RosterError } from './roster'
import type { Bot, BotMeta } from './types'

export interface ModelChoice {
  provider: string
  model: string
}

/** What the engine keeps for a profile, as the details panel edits it. */
export interface ProfileDetails {
  description: string
  soul: string
  model: ModelChoice | null
}

export interface DetailsDraft extends ProfileDetails {
  title: string
}

/** The engine wants a yes before it pins this model; nothing else is waiting on it. */
export interface ModelConfirm {
  message: string
  model: ModelChoice
}

const describeSchema = z.object({
  description: z.string().catch(''),
  soul: z.string().catch(''),
  model: z
    .object({ provider: z.string().catch(''), default: z.string().catch('') })
    .catch({ provider: '', default: '' })
})
const configureSchema = z.object({
  applied: z.record(z.string(), z.unknown()).catch({}),
  confirm_required: z.boolean().nullish(),
  confirm_message: z.string().nullish()
})

export async function loadDetails(
  backend: RosterBackend,
  profile: string
): Promise<ProfileDetails> {
  const { description, soul, model } = describeSchema.parse(
    await backend.request(profile, 'profiles.describe', { name: profile })
  )
  return {
    description,
    soul,
    model:
      model.provider && model.default ? { provider: model.provider, model: model.default } : null
  }
}

/** Title goes to the bot's metadata; description, SOUL and model to the profile, only if changed. */
export async function saveDetails(
  backend: RosterBackend,
  bot: Bot,
  change: { opening: DetailsDraft; draft: DetailsDraft }
): Promise<ModelConfirm | null> {
  const { opening, draft } = change
  const descriptionChanged = draft.description.trim() !== opening.description.trim()
  const meta: Partial<BotMeta> = {}
  if (draft.title.trim() !== opening.title.trim()) meta.title = draft.title.trim()
  // An older client's description in the metadata would hide the one saved on the profile.
  if (descriptionChanged && bot.meta.description !== undefined) meta.description = undefined
  if (Object.keys(meta).length > 0) await saveBotMeta(backend, bot.name, meta)

  const sections: Record<string, unknown> = {}
  if (descriptionChanged) sections.description = draft.description.trim()
  if (draft.soul !== opening.soul) sections.soul = draft.soul
  if (draft.model && !sameModel(draft.model, opening.model)) {
    sections.model = draft.model.model
    sections.provider = draft.model.provider
  }
  if (Object.keys(sections).length === 0) return null
  const result = await configure(backend, bot.name, sections)
  return result.confirm_required && draft.model
    ? { message: result.confirm_message ?? '', model: draft.model }
    : null
}

export async function confirmModel(
  backend: RosterBackend,
  profile: string,
  model: ModelChoice
): Promise<void> {
  await configure(backend, profile, {
    model: model.model,
    provider: model.provider,
    confirm_expensive_model: true
  })
}

async function configure(
  backend: RosterBackend,
  profile: string,
  sections: Record<string, unknown>
): Promise<z.infer<typeof configureSchema>> {
  const result = configureSchema.parse(
    await backend.request(profile, 'profiles.configure', { name: profile, ...sections })
  )
  const failed = Object.entries(result.applied).flatMap(([name, ok]) =>
    ok === false ? [name] : []
  )
  if (failed.length > 0) throw new RosterError('details.errorNotApplied', failed.join(', '))
  return result
}

function sameModel(a: ModelChoice, b: ModelChoice | null): boolean {
  return a.provider === b?.provider && a.model === b.model
}
