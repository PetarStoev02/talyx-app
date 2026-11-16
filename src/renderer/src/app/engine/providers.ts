import { keepBareEndpoint, listEndpoints } from '@shared/engine/endpoints'
import { assignMainModel } from '@shared/engine/mainModel'
import { randomUuid } from '@shared/engine/session-http-mutations'
import type { SessionMutationSnapshot } from '@shared/engine/session-http-mutations'
import type { MessageCompletePayload } from '@shared/engine/gateway-contract.generated'
import { reportError } from '@shared/lib/report'
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
  ProvidersBackend,
  TestChatResult
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
// A reply on an agent-sized request through a slow router can take a while; past this it is stuck.
// providers.errorTestChatTimeout names this time in words.
const TEST_CHAT_TIMEOUT_MS = 120_000
// How long a stopped turn gets to end before the test gives up on it.
const STOP_WAIT_MS = 10_000
const DELETE_ATTEMPTS = 3
const DELETE_RETRY_MS = 1_000
// The engine words a provider failure for people and quotes the provider's own message here.
const PROVIDER_SAID = /^Provider said: (.+)$/m
// Any other failure the engine words only as "something went wrong": the cause is in its agent
// log, as the last line of the traceback under the session's error line.
const LOG_TAIL_LINES = 400
const LOG_STAMP = /^\d{4}-\d{2}-\d{2} /
const SESSION_ERROR = 'Agent error in session'

/** Providers, keys, endpoints, sign-ins and Talyx's model over the engine's REST. */
export function engineProvidersBackend(
  engine: Pick<EngineAccess, 'http' | 'request' | 'onEvent'>
): ProvidersBackend {
  const rest = <T>(
    profile: string,
    path: string,
    {
      query = {},
      ...request
    }: { method?: string; body?: unknown; timeoutMs?: number; query?: Record<string, string> } = {}
  ): Promise<T> => engine.http<T>({ path: scoped(path, profile, query), profile, ...request })
  const env = (profile: string): Promise<Record<string, EnvVarInfo>> => rest(profile, '/api/env')

  // Each test chat's subscription: letting go of it keeps a redial from resuming a deleted chat.
  const subscriptions = new Map<string, string>()

  async function letGo(chatId: string): Promise<void> {
    const subscription = subscriptions.get(chatId)
    subscriptions.delete(chatId)
    if (!subscription) return
    await engine
      .request(HOME_PROFILE, 'session.detach', {
        session_id: chatId,
        subscription_id: subscription
      })
      // The chat is deleted either way; a subscription left over only fails to resume.
      .catch((error: unknown) => reportError('providers', error))
  }

  async function deleteChat(chatId: string): Promise<void> {
    const path = `/api/sessions/${encodeURIComponent(chatId)}`
    const now = await rest<SessionMutationSnapshot>(HOME_PROFILE, `${path}/mutation-snapshot`)
    if (!now.exists) return
    // A delete names the revision it read, so it never removes a chat that changed since.
    const fence = {
      request_id: randomUuid(),
      expected_revision: String(now.runtime_revision),
      ...(now.runtime_generation === null
        ? {}
        : { expected_generation: String(now.runtime_generation) })
    }
    await rest(HOME_PROFILE, path, { method: 'DELETE', query: fence })
  }

  // ponytail: reads the last lines of a log every session writes to; a busy engine can push the
  // chat's error out of them, and the engine's own words show instead.
  async function loggedError(chatId: string): Promise<string | null> {
    const { lines } = await rest<{ lines: string[] }>(HOME_PROFILE, '/api/logs', {
      query: { file: 'agent', lines: String(LOG_TAIL_LINES) }
    })
    const start = lines.findIndex((line) => line.includes(SESSION_ERROR) && line.includes(chatId))
    if (start < 0) return null
    const end = lines.findIndex((line, index) => index > start && LOG_STAMP.test(line))
    const trace = lines.slice(start + 1, end < 0 ? undefined : end)
    const said = trace.map((line) => line.trim()).filter(Boolean)
    return said[said.length - 1] ?? null
  }

  return {
    home: HOME_PROFILE,
    profiles: async () => {
      const { profiles } = await engine.http<{ profiles: Array<{ name: string }> }>({
        path: '/api/profiles'
      })
      return profiles.map((profile) => profile.name)
    },
    keys: async () => keySlots(await env(HOME_PROFILE)),
    endpoints: async (profile) => (await listEndpoints(engine.http, profile)).endpoints,
    accounts: async () => {
      const { providers } = await rest<{ providers: OAuthProvider[] }>(
        HOME_PROFILE,
        '/api/providers/oauth'
      )
      return providers.map(account)
    },
    model: async () => {
      const info = await rest<{ model?: string; provider?: string }>(
        HOME_PROFILE,
        '/api/model/info'
      )
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
      const { value } = await rest<{ value: string }>(HOME_PROFILE, '/api/env/reveal', {
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
      }>(HOME_PROFILE, '/api/providers/validate', {
        method: 'POST',
        body: { key: slot.key, value: slot.value, api_key: '' }
      })
      const verdict = !reachable ? 'unchecked' : ok ? 'works' : 'rejected'
      return { verdict, message }
    },
    checkEndpoint: async (draft) => {
      const { ok, message, models } = await rest<CustomEndpointValidationResponse>(
        HOME_PROFILE,
        '/api/providers/custom-endpoints/validate',
        {
          method: 'POST',
          body: { ...endpointBody(draft, null), model: draft.models[0]?.trim() ?? '' }
        }
      )
      return { ok, message, models }
    },
    openTestChat: async ({ provider, model }) => {
      const opened = await engine.request<{ session_id: string; subscription_id?: string }>(
        HOME_PROFILE,
        'session.create',
        { hidden: true, provider, model }
      )
      if (opened.subscription_id) subscriptions.set(opened.session_id, opened.subscription_id)
      return opened.session_id
    },
    askTestChat: async (chatId, text) => {
      const end = await askOnce(engine, chatId, text)
      if (end.turn.ok || end.quotesProvider) return end.turn
      const logged = await loggedError(chatId).catch((error: unknown) => {
        // Only a better account of the failure: the engine's own words still say what happened.
        reportError('providers', error)
        return null
      })
      return logged ? { ok: false, error: logged } : end.turn
    },
    closeTestChat: async (chatId) => {
      await letGo(chatId)
      for (let attempt = 1; ; attempt += 1) {
        try {
          return await deleteChat(chatId)
        } catch (error) {
          if (attempt === DELETE_ATTEMPTS) throw error
          // A turn that was just stopped can hold the chat for a moment.
          await new Promise((resolve) => setTimeout(resolve, DELETE_RETRY_MS))
        }
      }
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
      await keepBareEndpoint(engine.http, HOME_PROFILE, pick)
      const result = await assignMainModel(engine.http, HOME_PROFILE, pick)
      if (result.confirm_required) return { message: result.confirm_message ?? '', model: pick }
      if (result.ok === false) throw new ProvidersError('providers.errorModelNotSet')
      return null
    },
    confirmModel: async (pick) => {
      const result = await assignMainModel(engine.http, HOME_PROFILE, {
        ...pick,
        confirm_expensive_model: true
      })
      if (result.ok === false) throw new ProvidersError('providers.errorModelNotSet')
    },
    startSignIn: (providerId) =>
      rest<OAuthStartResponse>(
        HOME_PROFILE,
        `/api/providers/oauth/${encodeURIComponent(providerId)}/start`,
        { method: 'POST', body: {}, timeoutMs: SIGN_IN_START_TIMEOUT_MS }
      ),
    pollSignIn: async (sign) => {
      const path = scoped(
        `/api/providers/oauth/${encodeURIComponent(sign.providerId)}/poll/${encodeURIComponent(sign.sessionId)}`,
        HOME_PROFILE,
        { wait: String(SIGN_IN_WAIT_SECONDS) }
      )
      const result = await engine.http<OAuthPollResponse>({
        path,
        profile: HOME_PROFILE,
        timeoutMs: SIGN_IN_POLL_TIMEOUT_MS
      })
      if (result.status === 'approved' || result.status === 'pending')
        return { status: result.status }
      return { status: 'failed', message: result.error_message || result.status }
    },
    submitSignInCode: async (sign) => {
      const result = await rest<OAuthSubmitResponse>(
        HOME_PROFILE,
        `/api/providers/oauth/${encodeURIComponent(sign.providerId)}/submit`,
        { method: 'POST', body: { session_id: sign.sessionId, code: sign.code } }
      )
      return result.ok && result.status === 'approved'
        ? { status: 'approved' }
        : { status: 'failed', message: result.message || result.status }
    },
    cancelSignIn: async (sessionId) => {
      await rest(HOME_PROFILE, `/api/providers/oauth/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE'
      })
    },
    signOut: async (id) => {
      const result = await rest<{ ok: boolean }>(
        HOME_PROFILE,
        `/api/providers/oauth/${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      )
      if (!result.ok) throw new ProvidersError('providers.errorNotSignedOut')
    }
  }
}

/**
 * Sends the message and resolves with the turn's end. Listening starts before the send, so a
 * quick answer is not missed. A turn that runs out of time is stopped and given a moment to end,
 * since the engine will not delete a chat whose turn still runs.
 */
function askOnce(
  engine: Pick<EngineAccess, 'request' | 'onEvent'>,
  chatId: string,
  text: string
): Promise<TurnEnd> {
  return new Promise<TurnEnd>((resolve, reject) => {
    let stopping = false
    const timedOut = (): void =>
      finish(() => reject(new ProvidersError('providers.errorTestChatTimeout')))
    const stop = engine.onEvent((event) => {
      if (event.session_id !== chatId || event.type !== 'message.complete') return
      if (stopping) return timedOut()
      finish(() => resolve(turnEnd(event.payload as MessageCompletePayload | undefined)))
    })
    let timer = setTimeout(() => {
      stopping = true
      timer = setTimeout(timedOut, STOP_WAIT_MS)
      engine
        .request(HOME_PROFILE, 'session.interrupt', { session_id: chatId })
        .catch((error: unknown) => {
          reportError('providers', error)
          timedOut()
        })
    }, TEST_CHAT_TIMEOUT_MS)
    function finish(settle: () => void): void {
      clearTimeout(timer)
      stop()
      settle()
    }
    engine
      .request(HOME_PROFILE, 'prompt.submit', { session_id: chatId, text })
      .catch((error: unknown) => finish(() => reject(error)))
  })
}

/** How the turn ended; `quotesProvider` says the failure carries the provider's own message. */
interface TurnEnd {
  turn: TestChatResult
  quotesProvider: boolean
}

function turnEnd(payload: MessageCompletePayload = {}): TurnEnd {
  const text = typeof payload.text === 'string' ? payload.text.trim() : ''
  if (payload.status !== 'error' && payload.status !== 'interrupted' && text)
    return { turn: { ok: true, reply: text }, quotesProvider: false }
  const said = PROVIDER_SAID.exec(text)?.[1]?.trim()
  // Empty when the model sent nothing at all; the dialog says so.
  const error = said || text || payload.failure_reason || ''
  return { turn: { ok: false, error }, quotesProvider: !!said }
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
