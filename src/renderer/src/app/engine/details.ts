import { z } from 'zod'
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
import { problemOf } from '@shared/lib/problem'
import { MANAGER, SectionsNotSavedError } from '@features/bots/details'
import type { DetailsBackend, ModelChoice } from '@features/bots/details'
import type { EngineAccess } from './access'

const describeSchema = z.object({
  description: z.string().catch(''),
  soul: z.string().catch(''),
  model: z
    .object({ provider: z.string().catch(''), default: z.string().catch('') })
    .catch({ provider: '', default: '' })
})
const configureSchema = z.object({ applied: z.record(z.string(), z.unknown()).catch({}) })

/** A profile's details and its model pin over the engine. */
export function engineDetailsBackend(engine: EngineAccess): DetailsBackend {
  return {
    loadDetails: async (profile) => {
      const { description, soul, model } = describeSchema.parse(
        await engine.request(profile, 'profiles.describe', { name: profile })
      )
      return {
        description,
        soul,
        model:
          model.provider && model.default
            ? { provider: model.provider, model: model.default }
            : null
      }
    },
    saveSections: async (profile, sections) => {
      const result = configureSchema.parse(
        await engine.request(profile, 'profiles.configure', { name: profile, ...sections })
      )
      const failed = Object.entries(result.applied).flatMap(([name, ok]) =>
        ok === false ? [name] : []
      )
      if (failed.length > 0) throw new SectionsNotSavedError(failed)
    },
    pinModel: async (profile, pick) => {
      const result = await assignModel(engine, profile, pick)
      return result.confirm_required ? { message: result.confirm_message ?? '', model: pick } : null
    },
    pinAgreedModel: async (profile, pick) => {
      await assignModel(engine, profile, { ...pick, confirm_expensive_model: true })
    }
  }
}

async function assignModel(
  engine: EngineAccess,
  profile: string,
  pick: ModelChoice & { confirm_expensive_model?: boolean }
): Promise<ModelAssignmentResponse> {
  // A bare custom provider is only its URL, and a bot that was on another provider no longer has
  // it: it comes from Talyx's own profile, which every bot's custom endpoint copies.
  const endpoint = pick.provider === BARE_CUSTOM ? await homeEndpoint(engine) : null
  if (pick.provider !== BARE_CUSTOM) await copyHomeEndpoint(engine, profile, pick.provider)
  // Talyx's own model also changes here, from its details panel, as in Settings.
  if (profile === MANAGER) await keepBareEndpoint(engine.http, MANAGER, pick)
  const result = await assignMainModel(engine.http, profile, {
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
  engine: EngineAccess
): Promise<{ url: string; keyRef: string | null } | null> {
  const { current, endpoints } = await listEndpoints(engine.http, MANAGER)
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
  engine: EngineAccess,
  profile: string,
  provider: string
): Promise<void> {
  if (profile === MANAGER) return
  const [home, own] = await Promise.all([
    listEndpoints(engine.http, MANAGER),
    listEndpoints(engine.http, profile)
  ])
  const endpoint = home.endpoints.find(
    (item) => item.id === provider && item.source !== CONFIG_YAML_SOURCE
  )
  if (!endpoint || own.endpoints.some((item) => item.id === provider)) return
  await saveNamedEndpoint(engine.http, { profile, id: provider }, endpoint)
}
