import type { EngineApiRequest } from '@shared/engine/http'
import {
  BARE_CUSTOM,
  CONFIG_YAML_SOURCE,
  listEndpoints,
  saveNamedEndpoint
} from '@shared/engine/endpoints'
import { assignMainModel } from '@shared/engine/mainModel'
import type {
  CustomEndpoint,
  CustomEndpointsResponse,
  CustomEndpointValidationResponse,
  EnvVarInfo,
  OAuthPollResponse,
  OAuthProvider,
  OAuthProvidersResponse,
  OAuthStartResponse,
  OAuthSubmitResponse
} from '@shared/engine/types'
import type { TranslationKey } from '@shared/lib/i18n'
import { AppError } from '@shared/lib/problem'

export type { CustomEndpoint, OAuthStartResponse }

export interface ProvidersBackend {
  http: <T = unknown>(request: EngineApiRequest) => Promise<T>
  /** The profile new bots copy their model and endpoint from; every bot reads its sign-ins. */
  home: string
  /** Every profile on the engine, the home one included. */
  profiles: () => Promise<string[]>
}

/** One provider's API key, as the engine's key catalog lists it. */
export interface KeySlot {
  key: string
  provider: string
  docsUrl: string | null
  /** The engine's masked preview; null when no key is saved. */
  preview: string | null
}

export interface Account {
  id: string
  name: string
  flow: OAuthProvider['flow']
  signedIn: boolean
  /** False for a sign-in another tool owns; it is removed there. */
  disconnectable: boolean
  /** The command that signs in an external account. */
  command: string
}

export interface ModelPick {
  provider: string
  model: string
}

/** The engine wants a yes before it makes this model Talyx's; nothing is saved yet. */
export interface ModelConfirm {
  message: string
  model: ModelPick
}

export interface ProvidersOverview {
  keys: KeySlot[]
  endpoints: CustomEndpoint[]
  accounts: Account[]
  model: ModelPick | null
}

export interface EndpointDraft {
  /** The endpoint being edited; null adds a new one. */
  editing: CustomEndpoint | null
  name: string
  baseUrl: string
  /** Blank keeps the saved key. */
  apiKey: string
  models: string[]
}

export type SignInResult =
  | { status: 'approved' }
  | { status: 'failed'; message: string }
  | { status: 'cancelled' }

// Thrown for a providers problem the user can act on; `key` is its message in i18n.ts.
export class ProvidersError extends AppError {
  constructor(key: TranslationKey, detail: string | null = null) {
    super(key, detail)
    this.name = 'ProvidersError'
  }
}

// The engine holds a long-poll this long at most, and answers `pending` when it runs out.
const SIGN_IN_WAIT_SECONDS = 25
const SIGN_IN_POLL_TIMEOUT_MS = 45_000
const KEY_NAME = /(?:_API_KEY|_TOKEN|_KEY)$/
const REDACTED = /^«redacted:(.+)»$/

export async function loadProviders(backend: ProvidersBackend): Promise<ProvidersOverview> {
  const profile = backend.home
  const [env, custom, oauth, info] = await Promise.all([
    backend.http<Record<string, EnvVarInfo>>({ path: scoped('/api/env', profile), profile }),
    backend.http<CustomEndpointsResponse>({
      path: scoped('/api/providers/custom-endpoints', profile),
      profile
    }),
    backend.http<OAuthProvidersResponse>({
      path: scoped('/api/providers/oauth', profile),
      profile
    }),
    backend.http<{ model?: string; provider?: string }>({
      path: scoped('/api/model/info', profile),
      profile
    })
  ])
  return {
    keys: keySlots(env),
    endpoints: custom.endpoints,
    accounts: oauth.providers.map(account),
    model: info.model && info.provider ? { provider: info.provider, model: info.model } : null
  }
}

/** Saves the key on every bot; returns the bots that did not take it. */
export function saveKey(
  backend: ProvidersBackend,
  slot: { key: string; value: string }
): Promise<string[]> {
  const value = slot.value.trim()
  if (!value) throw new ProvidersError('providers.errorKeyEmpty')
  return onEveryBot(backend, (profile) =>
    backend.http({
      path: scoped('/api/env', profile),
      method: 'PUT',
      body: { key: slot.key, value, provider_setup: true },
      profile
    })
  )
}

export function removeKey(backend: ProvidersBackend, key: string): Promise<string[]> {
  return onEveryBot(backend, (profile) =>
    removing(
      backend.http({ path: scoped('/api/env', profile), method: 'DELETE', body: { key }, profile }),
      async () => {
        const env = await backend.http<Record<string, EnvVarInfo>>({
          path: scoped('/api/env', profile),
          profile
        })
        return env[key]?.is_set === true
      }
    )
  )
}

/** The saved key in full, only on an explicit ask. */
export async function revealKey(backend: ProvidersBackend, key: string): Promise<string> {
  const profile = backend.home
  const { value } = await backend.http<{ value: string }>({
    path: scoped('/api/env/reveal', profile),
    method: 'POST',
    body: { key },
    profile
  })
  return value
}

/**
 * What the provider said about the key: `unchecked` when the engine could not reach it, which is
 * no verdict (the key can still be saved); `message` says why a key was rejected.
 */
export async function checkKey(
  backend: ProvidersBackend,
  slot: { key: string; value: string }
): Promise<{ verdict: 'works' | 'rejected' | 'unchecked'; message: string }> {
  const profile = backend.home
  const { ok, reachable, message } = await backend.http<{
    ok: boolean
    reachable: boolean
    message: string
  }>({
    path: scoped('/api/providers/validate', profile),
    method: 'POST',
    body: { key: slot.key, value: slot.value.trim(), api_key: '' },
    profile
  })
  const verdict = !reachable ? 'unchecked' : ok ? 'works' : 'rejected'
  return { verdict, message }
}

/** Probes the endpoint's model list; `models` is what it serves. */
export async function checkEndpoint(
  backend: ProvidersBackend,
  draft: EndpointDraft
): Promise<{ ok: boolean; message: string; models: string[] }> {
  const profile = backend.home
  const { ok, message, models } = await backend.http<CustomEndpointValidationResponse>({
    path: scoped('/api/providers/custom-endpoints/validate', profile),
    method: 'POST',
    body: { ...endpointBody(draft, null), model: draft.models[0]?.trim() ?? '' },
    profile
  })
  return { ok, message, models }
}

/**
 * Saves the endpoint on every bot. The engine adds the listed models to the ones it has and
 * never drops one, so an edit can only add models. It never changes a bot's model; the default
 * model picks one of them.
 */
export function saveEndpoint(backend: ProvidersBackend, draft: EndpointDraft): Promise<string[]> {
  const models = [...new Set(draft.models.map((model) => model.trim()).filter(Boolean))]
  if (!draft.name.trim() || !draft.baseUrl.trim())
    throw new ProvidersError('providers.errorEndpointIncomplete')
  if (models.length === 0) throw new ProvidersError('providers.errorEndpointNoModels')
  if (keyMustBeRetyped(draft.editing) && !draft.apiKey.trim())
    throw new ProvidersError('providers.errorEndpointKeyNeeded')
  return onEveryBot(backend, (profile) =>
    backend.http({
      path: scoped('/api/providers/custom-endpoints', profile),
      method: 'POST',
      body: endpointBody({ ...draft, models }, models[0]),
      profile
    })
  )
}

/**
 * An endpoint written straight into config.yaml keeps its key there. A save moves it into the
 * engine's endpoint list and keeps only a key it is handed, so without one its bots lose access.
 */
export function keyMustBeRetyped(endpoint: CustomEndpoint | null): boolean {
  return endpoint?.source === CONFIG_YAML_SOURCE
}

/** The engine removes only endpoints from its own list, never one written into config.yaml. */
export function canRemoveEndpoint(endpoint: CustomEndpoint): boolean {
  return endpoint.source !== CONFIG_YAML_SOURCE
}

/** Removes the endpoint from every bot; a bot whose model it served falls back to its default. */
export function removeEndpoint(backend: ProvidersBackend, id: string): Promise<string[]> {
  return onEveryBot(backend, (profile) =>
    removing(
      backend.http({
        path: scoped(`/api/providers/custom-endpoints/${encodeURIComponent(id)}`, profile),
        method: 'DELETE',
        profile
      }),
      async () => {
        const { endpoints } = await backend.http<CustomEndpointsResponse>({
          path: scoped('/api/providers/custom-endpoints', profile),
          profile
        })
        return endpoints.some((endpoint) => endpoint.id === id)
      }
    )
  )
}

/**
 * Talyx's model, which new bots copy; other bots keep the model each one has. For a costly model
 * the engine saves nothing and asks first: the question comes back, `confirmDefaultModel` answers.
 */
export async function setDefaultModel(
  backend: ProvidersBackend,
  pick: ModelPick
): Promise<ModelConfirm | null> {
  await keepBareEndpoint(backend, pick)
  const result = await assignMainModel(backend.http, backend.home, pick)
  if (result.confirm_required) return { message: result.confirm_message ?? '', model: pick }
  if (result.ok === false) throw new ProvidersError('providers.errorModelNotSet')
  return null
}

export async function confirmDefaultModel(
  backend: ProvidersBackend,
  pick: ModelPick
): Promise<void> {
  const result = await assignMainModel(backend.http, backend.home, {
    ...pick,
    confirm_expensive_model: true
  })
  if (result.ok === false) throw new ProvidersError('providers.errorModelNotSet')
}

/**
 * A bare custom endpoint lives only in Talyx's model section, so a model on another provider
 * would erase it, and with it every bot's way back. Before Talyx leaves it, it is kept as a named
 * endpoint on Talyx's profile; a bot that picks it copies it then (see the bots' model pin).
 */
async function keepBareEndpoint(backend: ProvidersBackend, pick: ModelPick): Promise<void> {
  if (pick.provider === BARE_CUSTOM) return
  const { endpoints } = await listEndpoints(backend.http, backend.home)
  const bare = endpoints.find((endpoint) => endpoint.source === CONFIG_YAML_SOURCE)
  if (!bare) return
  const { host } = new URL(bare.base_url)
  await saveNamedEndpoint(
    backend.http,
    { profile: backend.home, id: `endpoint-${host.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}` },
    { ...bare, name: `Custom endpoint (${host})` }
  )
}

/** Opens a sign-in; the caller shows its code or page, then waits or submits. */
export async function startSignIn(
  backend: ProvidersBackend,
  providerId: string
): Promise<OAuthStartResponse> {
  const profile = backend.home
  return backend.http<OAuthStartResponse>({
    path: scoped(`/api/providers/oauth/${encodeURIComponent(providerId)}/start`, profile),
    method: 'POST',
    body: {},
    profile
  })
}

/** Waits for a device-code sign-in to finish in the browser; `live()` false stops waiting. */
export async function waitForSignIn(
  backend: ProvidersBackend,
  sign: { providerId: string; sessionId: string; live: () => boolean }
): Promise<SignInResult> {
  const profile = backend.home
  const path = scoped(
    `/api/providers/oauth/${encodeURIComponent(sign.providerId)}/poll/${encodeURIComponent(sign.sessionId)}`,
    profile,
    { wait: String(SIGN_IN_WAIT_SECONDS) }
  )
  while (sign.live()) {
    const result = await backend.http<OAuthPollResponse>({
      path,
      profile,
      timeoutMs: SIGN_IN_POLL_TIMEOUT_MS
    })
    if (!sign.live()) break
    if (result.status === 'approved') return { status: 'approved' }
    if (result.status !== 'pending')
      return { status: 'failed', message: result.error_message || result.status }
  }
  return { status: 'cancelled' }
}

/** Hands the engine the code the provider's page showed. */
export async function submitSignInCode(
  backend: ProvidersBackend,
  sign: { providerId: string; sessionId: string; code: string }
): Promise<SignInResult> {
  const profile = backend.home
  const result = await backend.http<OAuthSubmitResponse>({
    path: scoped(`/api/providers/oauth/${encodeURIComponent(sign.providerId)}/submit`, profile),
    method: 'POST',
    body: { session_id: sign.sessionId, code: sign.code.trim() },
    profile
  })
  return result.ok && result.status === 'approved'
    ? { status: 'approved' }
    : { status: 'failed', message: result.message || result.status }
}

export async function cancelSignIn(backend: ProvidersBackend, sessionId: string): Promise<void> {
  const profile = backend.home
  await backend.http({
    path: scoped(`/api/providers/oauth/sessions/${encodeURIComponent(sessionId)}`, profile),
    method: 'DELETE',
    profile
  })
}

/** Signs Talyx out of the account; bots without a sign-in of their own lose it too. */
export async function disconnectAccount(backend: ProvidersBackend, id: string): Promise<void> {
  const profile = backend.home
  const result = await backend.http<{ ok: boolean }>({
    path: scoped(`/api/providers/oauth/${encodeURIComponent(id)}`, profile),
    method: 'DELETE',
    profile
  })
  if (!result.ok) throw new ProvidersError('providers.errorNotSignedOut')
}

/** Builds the provider key list from the engine's env catalog, one slot per provider. */
function keySlots(env: Record<string, EnvVarInfo>): KeySlot[] {
  const byProvider = new Map<string, { key: string; info: EnvVarInfo; primary: boolean }[]>()
  for (const [key, info] of Object.entries(env)) {
    if (info.category !== 'provider') continue
    // A key shared by several routes is listed under each of them, saved once.
    const routes = info.provider_profiles?.length
      ? info.provider_profiles.map((route) => ({
          name: route.provider_label || route.provider,
          primary: route.primary === true,
          url: route.url ?? info.url
        }))
      : [{ name: info.provider_label || info.provider || '', primary: false, url: info.url }]
    for (const route of routes) {
      const name = route.name?.trim()
      if (!name || !(info.is_password || KEY_NAME.test(key))) continue
      const entry = { key, info: { ...info, url: route.url }, primary: route.primary }
      byProvider.set(name, [...(byProvider.get(name) ?? []), entry])
    }
  }
  return [...byProvider].map(([provider, entries]) => {
    const { key, info } =
      entries.find((entry) => entry.primary) ??
      entries.find((entry) => !entry.info.advanced) ??
      entries[0]
    return { key, provider, docsUrl: info.url, preview: info.is_set ? preview(info) : null }
  })
}

// A bot that never had it refuses the removal; that bot is done all the same.
async function removing(
  remove: Promise<unknown>,
  stillThere: () => Promise<boolean>
): Promise<void> {
  try {
    await remove
  } catch (error) {
    if (await stillThere()) throw error
  }
}

// The home profile goes first: if it refuses the change, no bot gets it.
async function onEveryBot(
  backend: ProvidersBackend,
  write: (profile: string) => Promise<unknown>
): Promise<string[]> {
  await write(backend.home)
  const others = (await backend.profiles()).filter((profile) => profile !== backend.home)
  const results = await Promise.allSettled(others.map(write))
  return others.filter((_, index) => results[index].status === 'rejected')
}

function endpointBody(draft: EndpointDraft, model: string | null): Record<string, unknown> {
  return {
    ...(draft.editing ? { id: draft.editing.id } : {}),
    name: draft.name.trim(),
    base_url: draft.baseUrl.trim(),
    ...(model ? { model, models: draft.models } : {}),
    // A blank key would clear the saved one; leaving it out keeps it.
    ...(draft.apiKey.trim() ? { api_key: draft.apiKey.trim() } : {}),
    // The engine rewrites this on every save: keep what the endpoint had. Talyx lists only the
    // saved models either way (see the chat's models).
    discover_models: draft.editing?.discover_models ?? true
  }
}

function account(provider: OAuthProvider): Account {
  return {
    id: provider.id,
    name: provider.name,
    flow: provider.flow,
    // A free tier holds a token but no account.
    signedIn: provider.status?.logged_in === true && provider.status.free_tier !== true,
    disconnectable: provider.disconnectable ?? provider.flow !== 'external',
    command: provider.cli_command
  }
}

function preview(info: EnvVarInfo): string {
  const value = info.redacted_value ?? ''
  const inner = REDACTED.exec(value)?.[1]?.trim()
  return inner || (value && !value.startsWith('«') ? value : '••••••••')
}

function scoped(path: string, profile: string, extra: Record<string, string> = {}): string {
  return `${path}?${new URLSearchParams({ profile, ...extra })}`
}
