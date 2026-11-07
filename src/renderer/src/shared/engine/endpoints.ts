import type { EngineHttp } from './http'
import type { CustomEndpoint, CustomEndpointsResponse } from './types'
import { AppError } from '@shared/lib/problem'

/** The engine's bare custom provider: an endpoint known only by its URL, with no named entry. */
export const BARE_CUSTOM = 'custom'
/** How the engine lists the bare custom endpoint, which lives in a profile's model section. */
export const CONFIG_YAML_SOURCE = 'direct-config'
// How the engine shows a key kept in an environment variable: a reference, not the key.
const ENV_REF = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/

export function listEndpoints(http: EngineHttp, profile: string): Promise<CustomEndpointsResponse> {
  return http<CustomEndpointsResponse>({
    path: `/api/providers/custom-endpoints?${new URLSearchParams({ profile })}`,
    profile
  })
}

/** The `${VAR}` the endpoint's key lives in, or null; a key written into the config is never one. */
export function keyRef(endpoint: CustomEndpoint): string | null {
  return ENV_REF.test(endpoint.api_key_preview ?? '') ? endpoint.api_key_preview! : null
}

/**
 * Writes the endpoint as the named entry `id` in the profile's providers. It goes through the
 * config merge, not the endpoint save: that save takes a key's value only and refuses its
 * variable, and Talyx never handles the value. A key written into the config cannot travel, so
 * that endpoint is refused rather than saved without it.
 */
export async function saveNamedEndpoint(
  http: EngineHttp,
  target: { profile: string; id: string },
  endpoint: CustomEndpoint
): Promise<void> {
  const ref = keyRef(endpoint)
  if (endpoint.has_api_key && !ref) throw new AppError('providers.errorEndpointKeyInConfig')
  const models = [...new Set([endpoint.model, ...endpoint.models].filter(Boolean))]
  const entry = {
    name: endpoint.name,
    base_url: endpoint.base_url,
    model: models[0],
    models: Object.fromEntries(models.map((model) => [model, {}])),
    discover_models: endpoint.discover_models,
    ...(endpoint.api_mode && { api_mode: endpoint.api_mode }),
    ...(ref && { key_env: ENV_REF.exec(ref)![1] })
  }
  await http({
    path: `/api/config?${new URLSearchParams({ profile: target.profile })}`,
    method: 'PUT',
    body: { config: { providers: { [target.id]: entry } } },
    profile: target.profile
  })
}

/**
 * A bare custom endpoint lives only in the profile's model section, so a model on another provider
 * would erase it, and with it every bot's way back. Before the profile leaves it, it is kept as a
 * named endpoint there; a bot that picks it copies it then (see the bots' model pin).
 */
export async function keepBareEndpoint(
  http: EngineHttp,
  profile: string,
  pick: { provider: string }
): Promise<void> {
  if (pick.provider === BARE_CUSTOM) return
  const { endpoints } = await listEndpoints(http, profile)
  const bare = endpoints.find((endpoint) => endpoint.source === CONFIG_YAML_SOURCE)
  // A named endpoint on the same URL already outlives the switch; a second would list it twice.
  const named = endpoints.some(
    (endpoint) => endpoint.source !== CONFIG_YAML_SOURCE && endpoint.base_url === bare?.base_url
  )
  if (!bare || named) return
  const { host } = new URL(bare.base_url)
  await saveNamedEndpoint(
    http,
    { profile, id: `endpoint-${host.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}` },
    { ...bare, name: `Custom endpoint (${host})` }
  )
}
