import { z } from 'zod'
import { create } from 'zustand'
import { saveBotMeta } from './data'
import type { RosterBackend } from './data'
import { exportAvatar, lookMeta, sameLook } from './look'
import type { Look } from './look'
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

// The manager's profile; its avatar is the logo, so it never gets an exported image.
const MANAGER = 'default'

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
 * The last details read per profile, so the chat's intro and the details panel show the same
 * ones. A save drops its profile's, so the intro reads them again.
 */
export const useProfileDetails = create<{ byProfile: Record<string, ProfileDetails> }>(() => ({
  byProfile: {}
}))

export async function loadDetails(
  backend: RosterBackend,
  profile: string
): Promise<ProfileDetails> {
  const { description, soul, model } = describeSchema.parse(
    await backend.request(profile, 'profiles.describe', { name: profile })
  )
  const details = {
    description,
    soul,
    model:
      model.provider && model.default ? { provider: model.provider, model: model.default } : null
  }
  useProfileDetails.setState((state) => ({
    byProfile: { ...state.byProfile, [profile]: details }
  }))
  return details
}

/** Keeps only the details of `profiles`, dropping deleted bots' ones. */
export function keepDetails(profiles: Set<string>): void {
  const { byProfile } = useProfileDetails.getState()
  if (Object.keys(byProfile).every((profile) => profiles.has(profile))) return
  useProfileDetails.setState({
    byProfile: Object.fromEntries(
      Object.entries(byProfile).filter(([profile]) => profiles.has(profile))
    )
  })
}

function forgetDetails(profile: string): void {
  useProfileDetails.setState(({ byProfile }) => ({
    byProfile: Object.fromEntries(Object.entries(byProfile).filter(([key]) => key !== profile))
  }))
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
    forgetDetails(bot.name)
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
    forgetDetails(profile)
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
  if (failed.length > 0) throw new RosterError('details.errorNotApplied', failed.join(', '))
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
