import { z } from 'zod'
import { create } from 'zustand'
import { saveBotMeta } from './data'
import type { RosterBackend } from './data'
import { exportAvatar, lookMeta, sameLook } from './look'
import type { Look } from './look'
import type { Problem } from '@shared/lib/problem'
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
  look: Look
}

/** The engine wants a yes before it pins this model; nothing else is waiting on it. */
export interface ModelConfirm {
  message: string
  model: ModelChoice
}

/** The profile sections the engine refused in one save, by their engine names. */
export class SectionsNotSavedError extends RosterError {
  constructor(readonly sections: string[]) {
    super('details.errorNotApplied', sections.join(', '))
    this.name = 'SectionsNotSavedError'
  }
}

/** Talyx's own profile, the manager. Its avatar is the logo, so it never gets an exported image. */
export const MANAGER = 'default'

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

/**
 * Counts saves of bot details, so a view that shows them (the chat's intro) reads them again;
 * the details panel and the intro each read their own.
 */
export const useDetailsRevision = create<{ revision: number }>(() => ({ revision: 0 }))

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

function detailsChanged(): void {
  useDetailsRevision.setState(({ revision }) => ({ revision: revision + 1 }))
}

/**
 * Title and look go to the bot's metadata; description, SOUL and model to the profile, only if
 * changed. A new look is exported as the profile's avatar image first, so a failed export saves
 * nothing and Save stays there to retry. Talyx is always the logo: only its face is its own.
 */
export async function saveDetails(
  backend: RosterBackend,
  bot: Bot,
  change: { opening: DetailsDraft; draft: DetailsDraft }
): Promise<ModelConfirm | null> {
  // Even a save that fails part way may have changed some of them.
  try {
    return await saveAll(backend, bot, change)
  } finally {
    detailsChanged()
  }
}

async function saveAll(
  backend: RosterBackend,
  bot: Bot,
  change: { opening: DetailsDraft; draft: DetailsDraft }
): Promise<ModelConfirm | null> {
  const { opening, draft } = change
  const descriptionChanged = draft.description.trim() !== opening.description.trim()
  const lookChanged = !sameLook(draft.look, opening.look)
  const manager = bot.name === MANAGER
  if (lookChanged && !manager) await exportAvatar(backend, bot.name, draft.look)
  const look = lookMeta(draft.look)
  const meta: Partial<BotMeta> = !lookChanged ? {} : manager ? { faces: look.faces } : look
  if (draft.title.trim() !== opening.title.trim()) meta.title = draft.title.trim()
  // An older client's description in the metadata would hide the one saved on the profile.
  if (descriptionChanged && bot.meta.description !== undefined) meta.description = undefined
  if (Object.keys(meta).length > 0) await saveBotMeta(backend, bot.name, meta)

  return saveSections(backend, bot.name, change)
}

export async function confirmModel(
  backend: RosterBackend,
  profile: string,
  model: ModelChoice
): Promise<void> {
  try {
    await configure(backend, profile, {
      model: model.model,
      provider: model.provider,
      confirm_expensive_model: true
    })
  } finally {
    detailsChanged()
  }
}

async function configure(
  backend: RosterBackend,
  profile: string,
  sections: Record<string, unknown>
): Promise<z.infer<typeof configureSchema>> {
  const result = configureSchema.parse(
    await backend.request(profile, 'profiles.configure', { name: profile, ...sections })
  )
  // A model waiting on the user's yes is not a failure, however the engine reports it.
  const failed = Object.entries(result.applied).flatMap(([name, ok]) =>
    ok === false && !(name === 'model' && result.confirm_required) ? [name] : []
  )
  if (failed.length > 0) throw new SectionsNotSavedError(failed)
  return result
}

async function saveSections(
  backend: RosterBackend,
  profile: string,
  { opening, draft }: { opening: DetailsDraft; draft: DetailsDraft }
): Promise<ModelConfirm | null> {
  const sections: Record<string, unknown> = {}
  if (draft.description.trim() !== opening.description.trim())
    sections.description = draft.description.trim()
  if (draft.soul !== opening.soul) sections.soul = draft.soul
  if (draft.model && !sameModel(draft.model, opening.model)) {
    sections.model = draft.model.model
    sections.provider = draft.model.provider
  }
  if (Object.keys(sections).length === 0) return null
  const result = await configure(backend, profile, sections)
  return result.confirm_required && draft.model
    ? { message: result.confirm_message ?? '', model: draft.model }
    : null
}

function sameModel(a: ModelChoice, b: ModelChoice | null): boolean {
  return a.provider === b?.provider && a.model === b.model
}

/**
 * What a refused section tells the user, shown under its field. The engine says only that a
 * section was not applied, so the reason is the likeliest one: a model whose provider is not set
 * up, or the engine failing to write.
 */
export function refusedSectionProblem(section: string): Problem {
  if (section === 'model') return { key: 'details.errorModel', detail: null }
  if (section === 'description') return { key: 'details.errorDescription', detail: null }
  if (section === 'soul') return { key: 'details.errorSoul', detail: null }
  return { key: 'details.errorNotApplied', detail: section }
}
