import { engineProvidersBackend } from '../../../src/renderer/src/app/engine/providers'
import type { EngineApiRequest, EngineHttp } from '../../../src/renderer/src/shared/engine/http'
import type { GatewayEvent } from '../../../src/renderer/src/shared/engine/host'
import type { ProvidersBackend } from '../../../src/renderer/src/features/providers/providers'
import type {
  CustomEndpoint,
  EnvVarInfo,
  OAuthPollResponse,
  OAuthProvider
} from '../../../src/renderer/src/shared/engine/types'

export const HOME = 'default'
// Models the engine asks about before making them a profile's main model.
const COSTLY = new Set(['paid-model'])

// The fields the routes below read; each route gets the ones it needs.
interface Body {
  key: string
  value: string
  code: string
  id?: string
  name: string
  base_url: string
  model: string
  models: string[]
  api_key?: string
  discover_models: boolean
  provider: string
  confirm_expensive_model?: boolean
  config: { providers: Record<string, NamedEntry> }
}

interface NamedEntry {
  name: string
  base_url: string
  model: string
  models: Record<string, object>
  discover_models: boolean
  key_env?: string
}

export interface ProfileConfig {
  env: Record<string, string>
  endpoints: CustomEndpoint[]
  model: { provider: string; model: string }
}

type Poll = OAuthPollResponse['status'] | 'timeout'

/** How the model behind a test chat answers: its reply, its failure, or never. */
export type ModelTurn =
  | { reply: string }
  | { failure: string; reason: string; logged?: string }
  | { stopped: true }
  | 'silent'

export interface EngineSession {
  id: string
  hidden: boolean
  model: string
  provider: string
  sent: string[]
  running: boolean
}

// How a request that ran out of time reaches the renderer from main.
const TIMED_OUT =
  "Error invoking remote method 'engine:http': TimeoutError: The operation was aborted due to timeout"

export interface ProvidersDouble {
  /** The real wiring over the in-memory REST below. */
  backend: ProvidersBackend
  /** The in-memory engine REST; the backend reads it on each call, so a test can wrap it. */
  http: EngineHttp
  profiles: Record<string, ProfileConfig>
  accounts: OAuthProvider[]
  /** Every write, as `<profile> <METHOD> <path>`, in order. */
  writes: string[]
  /** The last body each route took. */
  bodies: Record<string, unknown>
  /** The next polls answer these statuses, in order; `timeout` makes that poll time out. */
  polls: Poll[]
  failOn: (profile: string) => void
  /** Each profile's sessions; a test chat must leave none behind. */
  sessions: Record<string, EngineSession[]>
  /** How each model answers a message; a model not listed replies `pong`. */
  turns: Record<string, ModelTurn>
  /** Socket methods and REST paths that fail, as `<method>` or `<path>`. */
  refusing: Set<string>
  /** How many of the next session deletes the engine refuses as busy. */
  busyDeletes: { left: number }
  /** Sessions this window is subscribed to, so a redial would resume them. */
  subscribed: Set<string>
  /** Every socket call, as `<profile> <method>`, in order. */
  calls: string[]
  /** The engine's agent log, oldest line first. */
  log: string[]
  /** The last params each socket method took. */
  params: Record<string, Record<string, unknown>>
}

const catalog: Record<string, Partial<EnvVarInfo>> = {
  OPENAI_API_KEY: { provider_label: 'OpenAI API', url: 'https://openai.example/keys' },
  OPENAI_BASE_URL: { provider_label: 'OpenAI API', is_password: false, advanced: true },
  GLM_API_KEY: { provider_label: 'Z.AI (GLM)', advanced: true },
  ZAI_API_KEY: { provider_label: 'Z.AI (GLM)', advanced: true },
  DASHSCOPE_API_KEY: {
    provider_profiles: [
      { provider: 'qwen', provider_label: 'Qwen Cloud', primary: true, description: '', url: null },
      {
        provider: 'alibaba',
        provider_label: 'Alibaba Cloud',
        primary: true,
        description: '',
        url: null
      }
    ]
  },
  NOUS_BASE_URL: { is_password: false, advanced: true },
  SLACK_BOT_TOKEN: { category: 'messaging' }
}

export const ROUTER: CustomEndpoint = {
  id: 'custom',
  name: 'Custom',
  base_url: 'http://127.0.0.1:20128/v1',
  model: '9-route-provider',
  models: ['9-route-provider'],
  discover_models: true,
  has_api_key: true,
  api_key_preview: '${ROUTER_API_KEY}',
  is_current: true,
  source: 'direct-config'
}

// In-memory engine: env keys, custom endpoints and the main model per profile; OAuth on the home.
export function providersDouble(names = [HOME, 'analyst', 'writer']): ProvidersDouble {
  const profiles: Record<string, ProfileConfig> = Object.fromEntries(
    names.map((name) => [
      name,
      { env: {}, endpoints: [{ ...ROUTER }], model: { provider: 'custom', model: ROUTER.model } }
    ])
  )
  const accounts: OAuthProvider[] = [
    oauth('openai-codex', 'device_code', false),
    oauth('xai-oauth', 'pkce', false),
    oauth('claude-code', 'external', true),
    oauth('qwen-oauth', 'external', false)
  ]
  const writes: string[] = []
  const bodies: Record<string, unknown> = {}
  const polls: Poll[] = []
  const failing = new Set<string>()

  const sessions: Record<string, EngineSession[]> = Object.fromEntries(
    names.map((name) => [name, []])
  )
  const turns: Record<string, ModelTurn> = {}
  const refusing = new Set<string>()
  const busyDeletes = { left: 0 }
  const subscribed = new Set<string>()
  const calls: string[] = []
  const params: Record<string, Record<string, unknown>> = {}
  const listeners = new Set<(event: GatewayEvent) => void>()
  const log: string[] = ['2026-11-16 18:00:00,000 INFO gateway.run: started']
  let nextId = 0
  const revisions = new Map<string, number>()

  function emit(sessionId: string, type: string, payload: Record<string, unknown>): void {
    for (const listener of listeners)
      listener({ type, session_id: sessionId, payload } as GatewayEvent)
  }

  // The engine's socket: hidden sessions, one message each, answered on the next tick.
  async function request<T>(
    profile: string,
    method: string,
    sent: Record<string, unknown> = {}
  ): Promise<T> {
    calls.push(`${profile} ${method}`)
    params[method] = sent
    if (refusing.has(method)) throw new Error(`${method} refused`)
    const own = sessions[profile]
    const session = own.find((item) => item.id === sent.session_id)
    if (method === 'session.create') {
      const id = `local-${++nextId}`
      own.push({
        id,
        hidden: sent.hidden === true,
        model: String(sent.model ?? ''),
        provider: String(sent.provider ?? ''),
        sent: [],
        running: false
      })
      revisions.set(id, 0)
      subscribed.add(id)
      return { session_id: id, subscription_id: `sub-${id}` } as T
    }
    if (!session) throw new Error('session not found')
    if (method === 'prompt.submit') {
      session.sent.push(String(sent.text))
      session.running = true
      revisions.set(session.id, (revisions.get(session.id) ?? 0) + 1)
      setTimeout(() => answerTurn(session), 0)
      return { status: 'queued' } as T
    }
    // Stopping takes the engine a moment: the turn ends, as interrupted, after the answer.
    if (method === 'session.interrupt') {
      setTimeout(() => {
        session.running = false
        revisions.set(session.id, (revisions.get(session.id) ?? 0) + 1)
        emit(session.id, 'message.complete', { text: '', status: 'interrupted' })
      }, 50)
      return {} as T
    }
    if (method === 'session.detach') {
      if (sent.subscription_id !== `sub-${session.id}`) throw new Error('unknown subscription')
      subscribed.delete(session.id)
      return { session_id: session.id } as T
    }
    throw new Error(`Unexpected ${method}`)
  }

  function answerTurn(session: EngineSession): void {
    const turn = turns[session.model] ?? { reply: 'pong' }
    if (turn === 'silent') return
    session.running = false
    emit(session.id, 'message.start', {})
    if ('reply' in turn) {
      emit(session.id, 'message.delta', { text: turn.reply })
      emit(session.id, 'message.complete', { text: turn.reply, status: 'complete' })
    } else if ('failure' in turn) {
      // A failure the engine does not word for people is only in its log, as a traceback.
      if (turn.logged)
        log.push(
          `2026-11-16 18:16:02,530 ERROR gateway.run: Agent error in session agent:main:local:dm:${session.id}`,
          'Traceback (most recent call last):',
          '  File "run.py", line 1, in run',
          turn.logged,
          `2026-11-16 18:16:02,596 INFO gateway.platforms.base: Sending response to ${session.id}`
        )
      emit(session.id, 'message.complete', {
        text: turn.failure,
        status: 'error',
        failure_reason: turn.reason
      })
    } else emit(session.id, 'message.complete', { text: '', status: 'interrupted' })
  }

  // Deleting a session is fenced: read its revision, then delete naming that revision.
  function sessionRest(
    profile: string,
    method: string,
    path: string,
    query: URLSearchParams
  ): unknown {
    const id = decodeURIComponent(path.split('/')[3])
    const session = sessions[profile].find((item) => item.id === id)
    if (path.endsWith('/mutation-snapshot'))
      return session
        ? {
            session_id: id,
            exists: true,
            runtime_revision: revisions.get(id),
            runtime_generation: 1
          }
        : { session_id: id, exists: false, runtime_revision: 0, runtime_generation: null }
    if (method !== 'DELETE') throw new Error(`Unexpected ${method} ${path}`)
    if (!session) throw new Error('HTTP 404: not_found')
    if (!query.get('request_id')) throw new Error('mutation_identity_required')
    if (Number(query.get('expected_revision')) !== revisions.get(id))
      throw new Error('revision_conflict')
    if (session.running) throw new Error('session_busy')
    if (busyDeletes.left > 0) {
      busyDeletes.left -= 1
      throw new Error('session_busy')
    }
    sessions[profile] = sessions[profile].filter((item) => item !== session)
    return { ok: true, deleted_ids: [id] }
  }

  function answer(
    profile: string,
    method: string,
    path: string,
    body: Body,
    query = new URLSearchParams()
  ): unknown {
    const config = profiles[profile]
    if (method !== 'GET') {
      if (failing.has(profile)) throw new Error(`HTTP 500 on ${profile}`)
      writes.push(`${profile} ${method} ${path}`)
      bodies[`${method} ${path}`] = body
    }
    if (path === '/api/env' && method === 'GET') return envOf(config)
    if (path === '/api/env' && method === 'PUT') return void (config.env[body.key] = body.value)
    if (path === '/api/env' && method === 'DELETE') {
      if (!(body.key in config.env)) throw new Error(`HTTP 404: ${body.key} not found in .env`)
      return void delete config.env[body.key]
    }
    if (path === '/api/env/reveal') return { key: body.key, value: config.env[body.key] }
    if (path === '/api/providers/validate')
      return body.value === 'offline'
        ? { ok: true, reachable: false, message: '' }
        : body.value.startsWith('sk-')
          ? { ok: true, reachable: true, message: '' }
          : { ok: false, reachable: true, message: 'Key rejected' }
    if (path === '/api/providers/custom-endpoints' && method === 'GET')
      return { current: {}, endpoints: config.endpoints }
    if (path === '/api/providers/custom-endpoints/validate')
      return { ok: true, reachable: true, message: '', models: ['a', 'b', 'c'] }
    if (path === '/api/providers/custom-endpoints') {
      const id = body.id ?? body.name.toLowerCase()
      const existing = config.endpoints.find((e) => e.id === id)
      const saved: CustomEndpoint = {
        id,
        name: body.name,
        base_url: body.base_url,
        model: body.model,
        // The engine adds the listed models to the saved ones and never drops one.
        models: [...new Set([...(existing?.models ?? []), ...body.models])],
        discover_models: body.discover_models,
        source: 'providers',
        // A save moves a config.yaml endpoint into the list, keeping only a key it is handed.
        has_api_key: Boolean(body.api_key) || savedKey(existing)
      }
      config.endpoints = [...config.endpoints.filter((e) => e.id !== id), saved]
      return { endpoints: config.endpoints }
    }
    if (path.startsWith('/api/providers/custom-endpoints/') && method === 'DELETE') {
      const id = decodeURIComponent(path.split('/').at(-1)!)
      if (config.endpoints.find((e) => e.id === id)?.source !== 'providers')
        throw new Error('HTTP 404: custom endpoint not found')
      config.endpoints = config.endpoints.filter((e) => e.id !== id)
      // The engine detaches a main model the endpoint served.
      if (config.model.provider === id) config.model = { provider: '', model: '' }
      return { endpoints: config.endpoints }
    }
    if (path === '/api/model/info') return config.model
    if (path === '/api/model/set') {
      if (COSTLY.has(body.model) && !body.confirm_expensive_model)
        return { ok: false, confirm_required: true, confirm_message: `${body.model} costs more.` }
      config.model = { provider: body.provider, model: body.model }
      // Another provider's URL replaces the model section's, and the bare endpoint goes with it.
      if (body.provider !== 'custom')
        config.endpoints = config.endpoints.filter((e) => e.source !== 'direct-config')
      return { ok: true, provider: body.provider, model: body.model }
    }
    if (path === '/api/config' && method === 'PUT') {
      const [[id, entry]] = Object.entries(body.config.providers)
      const keyEnv = entry.key_env
      const saved: CustomEndpoint = {
        id,
        name: entry.name,
        base_url: entry.base_url,
        model: entry.model,
        models: Object.keys(entry.models),
        discover_models: entry.discover_models,
        has_api_key: !!keyEnv,
        api_key_preview: keyEnv ? `\${${keyEnv}}` : null,
        source: 'providers'
      }
      config.endpoints = [...config.endpoints.filter((e) => e.id !== id), saved]
      return { ok: true }
    }
    if (refusing.has(path)) throw new Error(`HTTP 500 on ${path}`)
    if (path.startsWith('/api/sessions/')) return sessionRest(profile, method, path, query)
    if (path === '/api/logs')
      return { file: query.get('file'), lines: log.slice(-Number(query.get('lines') ?? 100)) }
    if (path === '/api/providers/oauth') return { providers: accounts }
    if (path.endsWith('/start'))
      return path.includes('xai')
        ? { flow: 'pkce', session_id: 's-pkce', auth_url: 'https://x.example', expires_in: 600 }
        : {
            flow: 'device_code',
            session_id: 's-device',
            user_code: 'ABCD-1234',
            verification_url: 'https://openai.example/device',
            expires_in: 600,
            poll_interval: 5
          }
    if (path.includes('/poll/')) {
      const status = polls.shift() ?? 'pending'
      if (status === 'timeout') throw new Error(TIMED_OUT)
      if (status === 'approved') signIn(path)
      return { session_id: 's-device', status }
    }
    if (path.endsWith('/submit')) {
      if (body.code !== 'good') return { ok: false, status: 'error' }
      signIn(path)
      return { ok: true, status: 'approved' }
    }
    if (path === '/api/model/options')
      return {
        providers: config.endpoints.map((endpoint) => ({
          slug: endpoint.id,
          name: endpoint.name,
          is_user_defined: true,
          api_url: endpoint.base_url,
          // What a router lists beyond its saved models.
          models: [...endpoint.models, 'behind/the-router']
        }))
      }
    if (path.startsWith('/api/providers/oauth/sessions/')) return { ok: true }
    if (path.startsWith('/api/providers/oauth/') && method === 'DELETE') {
      const account = accounts.find((item) => path.endsWith(item.id))
      const ok = account?.status.logged_in === true
      if (account) account.status = { logged_in: false }
      return { ok }
    }
    throw new Error(`Unexpected ${method} ${path}`)
  }

  function signIn(path: string): void {
    const account = accounts.find((item) => path.includes(`/oauth/${item.id}/`))
    if (account) account.status = { logged_in: true }
  }

  const http = async <T>(request: EngineApiRequest): Promise<T> => {
    if (request.path === '/api/profiles')
      return { profiles: Object.keys(profiles).map((name) => ({ name })) } as T
    const url = new URL(request.path, 'http://engine.invalid')
    const profile = url.searchParams.get('profile') ?? ''
    if (profile !== request.profile) throw new Error('profile query and grant disagree')
    return answer(
      profile,
      request.method ?? 'GET',
      url.pathname,
      request.body as Body,
      url.searchParams
    ) as T
  }
  const double: ProvidersDouble = {
    backend: engineProvidersBackend({
      http: <T>(request: EngineApiRequest) => double.http<T>(request),
      request,
      onEvent: (handler) => {
        listeners.add(handler)
        return () => listeners.delete(handler)
      }
    }),
    http,
    profiles,
    accounts,
    writes,
    bodies,
    polls,
    failOn: (profile) => failing.add(profile),
    sessions,
    turns,
    refusing,
    busyDeletes,
    subscribed,
    calls,
    params,
    log
  }
  return double
}

function savedKey(endpoint: CustomEndpoint | undefined): boolean {
  return endpoint?.source === 'providers' && endpoint.has_api_key
}

function envOf(config: ProfileConfig): Record<string, EnvVarInfo> {
  return Object.fromEntries(
    Object.entries(catalog).map(([key, info]) => [
      key,
      {
        advanced: false,
        category: 'provider',
        description: '',
        is_password: true,
        tools: [],
        url: null,
        ...info,
        is_set: key in config.env,
        redacted_value: key in config.env ? `«redacted:${config.env[key].slice(0, 3)}…»` : null
      } as EnvVarInfo
    ])
  )
}

function oauth(id: string, flow: OAuthProvider['flow'], signedIn: boolean): OAuthProvider {
  return {
    id,
    name: id,
    flow,
    cli_command: `acme auth add ${id}`,
    docs_url: '',
    status: { logged_in: signedIn }
  }
}
