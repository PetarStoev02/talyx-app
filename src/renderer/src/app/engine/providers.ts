import { keepBareEndpoint, listEndpoints } from '@shared/engine/endpoints'
import { assignMainModel } from '@shared/engine/mainModel'
import type {
  CustomEndpointValidationResponse,
  EnvVarInfo,
  OAuthPollResponse,
  OAuthProvider,
  OAuthStartResponse,
  OAuthSubmitResponse
} from '@shared/engine/types'
import { ProvidersError } from '@features/providers/providers'
import type {
  Account,
  EndpointDraft,
  KeySlot,
  ModelPick,
  ProvidersBackend
} from '@features/providers/providers'
import type { EngineAccess } from './access'

/** The manager bot's profile: new bots copy its model and endpoint, every bot reads its sign-ins. */
const HOME_PROFILE = 'default'
// The engine holds a long-poll this long at most, and answers `pending` when it runs out.
const SIGN_IN_WAIT_SECONDS = 25
const SIGN_IN_POLL_TIMEOUT_MS = 45_000
// Starting a sign-in right after the gateway starts can take longer than the usual 30 s.
const SIGN_IN_START_TIMEOUT_MS = 60_000
const KEY_NAME = /(?:_API_KEY|_TOKEN|_KEY)$/
const REDACTED = /^«redacted:(.+)»$/

/** Providers, keys, endpoints, sign-ins and Talyx's model over the engine's REST. */
export function engineProvidersBackend(engine: Pick<EngineAccess, 'http'>): ProvidersBackend {
  const home = HOME_PROFILE
  const rest = <T>(
    profile: string,
    path: string,
    request: { method?: string; body?: unknown; timeoutMs?: number } = {}
  ): Promise<T> => engine.http<T>({ path: scoped(path, profile), profile, ...request })
  const env = (profile: string): Promise<Record<string, EnvVarInfo>> => rest(profile, '/api/env')

  return {
    home,
    profiles: async () => {
      const { profiles } = await engine.http<{ profiles: Array<{ name: string }> }>({
        path: '/api/profiles'
      })
      return profiles.map((profile) => profile.name)
    },
    keys: async () => keySlots(await env(home)),
    endpoints: async (profile) => (await listEndpoints(engine.http, profile)).endpoints,
    accounts: async () => {
      const { providers } = await rest<{ providers: OAuthProvider[] }>(home, '/api/providers/oauth')
      return providers.map(account)
    },
    model: async () => {
      const info = await rest<{ model?: string; provider?: string }>(home, '/api/model/info')
      return info.model && info.provider ? { provider: info.provider, model: info.model } : null
    },
    saveKey: async (profile, slot) => {
      await rest(profile, '/api/env', {
        method: 'PUT',
        body: { key: slot.key, value: slot.value, provider_setup: true }
      })
    },
    removeKey: async (profile, key) => {
      await rest(profile, '/api/env', { method: 'DELETE', body: { key } })
    },
    hasKey: async (profile, key) => (await env(profile))[key]?.is_set === true,
    revealKey: async (key) => {
      const { value } = await rest<{ value: string }>(home, '/api/env/reveal', {
        method: 'POST',
        body: { key }
      })
      return value
    },
    checkKey: async (slot) => {
      const { ok, reachable, message } = await rest<{
        ok: boolean
        reachable: boolean
        message: string
      }>(home, '/api/providers/validate', {
        method: 'POST',
        body: { key: slot.key, value: slot.value, api_key: '' }
      })
      const verdict = !reachable ? 'unchecked' : ok ? 'works' : 'rejected'
      return { verdict, message }
    },
    checkEndpoint: async (draft) => {
      const { ok, message, models } = await rest<CustomEndpointValidationResponse>(
        home,
        '/api/providers/custom-endpoints/validate',
        {
          method: 'POST',
          body: { ...endpointBody(draft, null), model: draft.models[0]?.trim() ?? '' }
        }
      )
      return { ok, message, models }
    },
    saveEndpoint: async (profile, draft) => {
      await rest(profile, '/api/providers/custom-endpoints', {
        method: 'POST',
        body: endpointBody(draft, draft.models[0])
      })
    },
    removeEndpoint: async (profile, id) => {
      await rest(profile, `/api/providers/custom-endpoints/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      })
    },
    setModel: async (pick) => {
      await keepBareEndpoint(engine.http, home, pick)
      const result = await assignMainModel(engine.http, home, pick)
      if (result.confirm_required) return { message: result.confirm_message ?? '', model: pick }
      if (result.ok === false) throw new ProvidersError('providers.errorModelNotSet')
      return null
    },
    confirmModel: async (pick: ModelPick) => {
      const result = await assignMainModel(engine.http, home, {
        ...pick,
        confirm_expensive_model: true
      })
      if (result.ok === false) throw new ProvidersError('providers.errorModelNotSet')
    },
    startSignIn: (providerId) =>
      rest<OAuthStartResponse>(
        home,
        `/api/providers/oauth/${encodeURIComponent(providerId)}/start`,
        { method: 'POST', body: {}, timeoutMs: SIGN_IN_START_TIMEOUT_MS }
      ),
    pollSignIn: async (sign) => {
      const path = scoped(
        `/api/providers/oauth/${encodeURIComponent(sign.providerId)}/poll/${encodeURIComponent(sign.sessionId)}`,
        home,
        { wait: String(SIGN_IN_WAIT_SECONDS) }
      )
      const result = await engine.http<OAuthPollResponse>({
        path,
        profile: home,
        timeoutMs: SIGN_IN_POLL_TIMEOUT_MS
      })
      if (result.status === 'approved' || result.status === 'pending')
        return { status: result.status }
      return { status: 'failed', message: result.error_message || result.status }
    },
    submitSignInCode: async (sign) => {
      const result = await rest<OAuthSubmitResponse>(
        home,
        `/api/providers/oauth/${encodeURIComponent(sign.providerId)}/submit`,
        { method: 'POST', body: { session_id: sign.sessionId, code: sign.code } }
      )
      return result.ok && result.status === 'approved'
        ? { status: 'approved' }
        : { status: 'failed', message: result.message || result.status }
    },
    cancelSignIn: async (sessionId) => {
      await rest(home, `/api/providers/oauth/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE'
      })
    },
    signOut: async (id) => {
      const result = await rest<{ ok: boolean }>(
        home,
        `/api/providers/oauth/${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      )
      if (!result.ok) throw new ProvidersError('providers.errorNotSignedOut')
    }
  }
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
