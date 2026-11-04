import type { EngineApiRequest } from '../../../src/renderer/src/shared/engine/http'
import type { ProvidersBackend } from '../../../src/renderer/src/features/providers/providers'
import type {
  CustomEndpoint,
  EnvVarInfo,
  OAuthPollResponse,
  OAuthProvider
} from '../../../src/renderer/src/shared/engine/types'

export const HOME = 'default'

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
}

export interface ProfileConfig {
  env: Record<string, string>
  endpoints: CustomEndpoint[]
  model: { provider: string; model: string }
}

export interface ProvidersDouble {
  backend: ProvidersBackend
  profiles: Record<string, ProfileConfig>
  accounts: OAuthProvider[]
  /** Every write, as `<profile> <METHOD> <path>`, in order. */
  writes: string[]
  /** The last body each route took. */
  bodies: Record<string, unknown>
  /** The next polls answer these statuses, in order. */
  polls: OAuthPollResponse['status'][]
  failOn: (profile: string) => void
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
  const polls: OAuthPollResponse['status'][] = []
  const failing = new Set<string>()

  function answer(profile: string, method: string, path: string, body: Body): unknown {
    const config = profiles[profile]
    if (method !== 'GET') {
      if (failing.has(profile)) throw new Error(`HTTP 500 on ${profile}`)
      writes.push(`${profile} ${method} ${path}`)
      bodies[`${method} ${path}`] = body
    }
    if (path === '/api/env' && method === 'GET') return envOf(config)
    if (path === '/api/env' && method === 'PUT') return void (config.env[body.key] = body.value)
    if (path === '/api/env' && method === 'DELETE') return void delete config.env[body.key]
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
      const saved: CustomEndpoint = {
        id,
        name: body.name,
        base_url: body.base_url,
        model: body.model,
        models: body.models,
        discover_models: body.discover_models,
        source: 'providers',
        // A save moves a config.yaml endpoint into the list, keeping only a key it is handed.
        has_api_key: Boolean(body.api_key) || savedKey(config.endpoints.find((e) => e.id === id))
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
    if (path === '/api/model/set') return void (config.model = { ...body })
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

  const backend: ProvidersBackend = {
    home: HOME,
    profiles: async () => Object.keys(profiles),
    http: async <T>(request: EngineApiRequest) => {
      const url = new URL(request.path, 'http://engine.invalid')
      const profile = url.searchParams.get('profile') ?? ''
      if (profile !== request.profile) throw new Error('profile query and grant disagree')
      return answer(profile, request.method ?? 'GET', url.pathname, request.body as Body) as T
    }
  }
  return {
    backend,
    profiles,
    accounts,
    writes,
    bodies,
    polls,
    failOn: (profile) => failing.add(profile)
  }
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
