import { z } from 'zod'
import { create } from 'zustand'
import {
  BARE_CUSTOM,
  CONFIG_YAML_SOURCE,
  keepBareEndpoint,
  keyRef,
  listEndpoints,
  saveNamedEndpoint
} from '@shared/engine/endpoints'
import { assignMainModel } from '@shared/engine/mainModel'
import type { ModelAssignmentResponse } from '@shared/engine/types'
import { saveBotMeta } from './data'
import type { RosterBackend } from './data'
import { exportAvatar, lookMeta, sameLook } from './look'
import type { Look } from './look'
import { problemOf } from '@shared/lib/problem'
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

/**
 * The profile sections the engine refused in one save, by their engine names. `reason` is what the
 * engine said about a refused model, when it said something.
 */
export class SectionsNotSavedError extends RosterError {
  constructor(
    readonly sections: string[],
    readonly reason: string | null = null
  ) {
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
const configureSchema = z.object({ applied: z.record(z.string(), z.unknown()).catch({}) })

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
    await confirmBotModel(backend, profile, model)
  } finally {
    detailsChanged()
  }
}

/**
 * Pins the bot's model. For a costly model the engine saves nothing and asks first: the question
 * comes back, `confirmBotModel` answers it. A refusal is a `SectionsNotSavedError` for `model`.
 */
export async function setBotModel(
  backend: RosterBackend,
  profile: string,
  pick: ModelChoice
): Promise<ModelConfirm | null> {
  const result = await assignModel(backend, profile, pick)
  return result.confirm_required ? { message: result.confirm_message ?? '', model: pick } : null
}

/** Pins the bot's model after the user said yes to its cost. */
export async function confirmBotModel(
  backend: RosterBackend,
  profile: string,
  pick: ModelChoice
): Promise<void> {
  await assignModel(backend, profile, { ...pick, confirm_expensive_model: true })
}

async function assignModel(
  backend: RosterBackend,
  profile: string,
  pick: ModelChoice & { confirm_expensive_model?: boolean }
): Promise<ModelAssignmentResponse> {
  // A bare custom provider is only its URL, and a bot that was on another provider no longer has
  // it: it comes from Talyx's own profile, which every bot's custom endpoint copies.
  const endpoint = pick.provider === BARE_CUSTOM ? await homeEndpoint(backend) : null
  if (pick.provider !== BARE_CUSTOM) await copyHomeEndpoint(backend, profile, pick.provider)
  // Talyx's own model also changes here, from its details panel, as in Settings.
  if (profile === MANAGER) await keepBareEndpoint(backend.http, MANAGER, pick)
  const result = await assignMainModel(backend.http, profile, {
    ...pick,
    ...(endpoint && { base_url: endpoint.url }),
    // Talyx already holds its key; a `${VAR}` written into its own model section would read back
    // expanded, and the reference every bot copies would be lost.
    ...(endpoint?.keyRef && profile !== MANAGER && { api_key: endpoint.keyRef })
  }).catch((error: unknown) => {
    // The engine answers a model it refuses with an HTTP error; its words go under the field, so
    // a timeout or a restart is not mistaken for a provider that is not set up.
    throw new SectionsNotSavedError(['model'], problemOf(error).detail)
  })
  if (!result.ok && !result.confirm_required) throw new SectionsNotSavedError(['model'])
  return result
}

/**
 * Talyx's bare custom endpoint, or null when its model is on another provider. `keyRef` is where
 * the endpoint's key lives, as the engine's `${VAR}` reference to a variable every bot's .env has;
 * a key written into the config shows only redacted and is never sent.
 */
async function homeEndpoint(
  backend: RosterBackend
): Promise<{ url: string; keyRef: string | null } | null> {
  const { current, endpoints } = await listEndpoints(backend.http, MANAGER)
  if (current.provider !== BARE_CUSTOM || !current.base_url) return null
  const endpoint = endpoints.find((item) => item.base_url === current.base_url)
  return { url: current.base_url, keyRef: endpoint ? keyRef(endpoint) : null }
}

/**
 * A named endpoint of Talyx's that the bot lacks, such as one created after it or the one Talyx
 * kept when its own model left it, is copied onto the bot first: the engine pins only a provider
 * the bot's config names.
 */
async function copyHomeEndpoint(
  backend: RosterBackend,
  profile: string,
  provider: string
): Promise<void> {
  if (profile === MANAGER) return
  const [home, own] = await Promise.all([
    listEndpoints(backend.http, MANAGER),
    listEndpoints(backend.http, profile)
  ])
  const endpoint = home.endpoints.find(
    (item) => item.id === provider && item.source !== CONFIG_YAML_SOURCE
  )
  if (!endpoint || own.endpoints.some((item) => item.id === provider)) return
  await saveNamedEndpoint(backend.http, { profile, id: provider }, endpoint)
}

async function configure(
  backend: RosterBackend,
  profile: string,
  sections: Record<string, unknown>
): Promise<void> {
  const result = configureSchema.parse(
    await backend.request(profile, 'profiles.configure', { name: profile, ...sections })
  )
  const failed = Object.entries(result.applied).flatMap(([name, ok]) =>
    ok === false ? [name] : []
  )
  if (failed.length > 0) throw new SectionsNotSavedError(failed)
}

// Description and SOUL go in one configure call, the model through its own pin; a refusal of
// either does not stop the other, and every refused section is reported together.
async function saveSections(
  backend: RosterBackend,
  profile: string,
  { opening, draft }: { opening: DetailsDraft; draft: DetailsDraft }
): Promise<ModelConfirm | null> {
  const sections: Record<string, unknown> = {}
  if (draft.description.trim() !== opening.description.trim())
    sections.description = draft.description.trim()
  if (draft.soul !== opening.soul) sections.soul = draft.soul
  const model = draft.model && !sameModelChoice(draft.model, opening.model) ? draft.model : null
  const refused: string[] = []
  let reason: string | null = null
  const refusing = (error: unknown): null => {
    if (!(error instanceof SectionsNotSavedError)) throw error
    refused.push(...error.sections)
    reason ??= error.reason
    return null
  }
  if (Object.keys(sections).length > 0) await configure(backend, profile, sections).catch(refusing)
  const confirm = model ? await setBotModel(backend, profile, model).catch(refusing) : null
  if (refused.length > 0) throw new SectionsNotSavedError(refused, reason)
  return confirm
}

export function sameModelChoice(a: ModelChoice, b: ModelChoice | null): boolean {
  return a.provider === b?.provider && a.model === b.model
}

/**
 * What a refused section tells the user, shown under its field. For description and SOUL the
 * engine says only that the section was not applied, so the message gives the likeliest reason;
 * a refused model also shows the engine's own words.
 */
export function refusedSectionProblem(section: string, reason: string | null = null): Problem {
  if (section === 'model') return { key: 'details.errorModel', detail: reason }
  if (section === 'description') return { key: 'details.errorDescription', detail: null }
  if (section === 'soul') return { key: 'details.errorSoul', detail: null }
  return { key: 'details.errorNotApplied', detail: section }
}
