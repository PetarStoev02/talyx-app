import type { ChatBackend } from '../../../src/renderer/src/features/chat/chat'
import type { SessionMessage } from '../../../src/renderer/src/shared/engine/types'
import type { EngineHttpRequest } from '../../../src/shared/engine'

export interface ChatCall {
  profile: string
  method: string
  params: Record<string, unknown>
}

export interface ChatDouble {
  backend: ChatBackend
  calls: ChatCall[]
  // Every Bot Chat by profile: its session id, stored messages and the turn the engine still
  // holds outside them (a failed turn is never stored; resume carries it until the next turn).
  chats: Record<
    string,
    {
      sessionId: string
      messages: SessionMessage[]
      inflight?: Record<string, unknown>
      queued?: { user: string }
    }
  >
  failNext: (method: string, message: string) => void
  // Holds the next call to `method` until the returned release runs.
  holdNext: (method: string) => () => void
  /** Files the engine has cleared from its cache: main answers null for them. */
  goneMedia: Set<string>
}

/** A profile on its bare custom endpoint that also keeps the same URL as a named one. */
export const KEPT_ENDPOINT_PROFILE = 'acme-kept'
const ROUTER_URL = 'http://127.0.0.1:20128/v1'

// In-memory engine for the chat: Bot Chat lookup, create, resume, submit and the REST paths.
export function chatDouble(
  chats: ChatDouble['chats'] = {
    'acme-manager': {
      sessionId: 'manager-chat',
      messages: [
        { id: 1, role: 'user', content: 'Hello' },
        { id: 2, role: 'assistant', content: 'Hi there' }
      ]
    }
  }
): ChatDouble {
  const calls: ChatCall[] = []
  const failures = new Map<string, string>()
  const holds = new Map<string, Promise<void>>()
  const goneMedia = new Set<string>()
  let created = 0
  const answer = (profile: string, method: string, params: Record<string, unknown>): unknown => {
    calls.push({ profile, method, params })
    const failure = failures.get(method)
    if (failure) {
      failures.delete(method)
      throw new Error(failure)
    }
    const chat = chats[profile]
    switch (method) {
      case 'session.list':
        return { sessions: chat ? [{ id: chat.sessionId, title: 'Bot Chat' }] : [] }
      case 'session.create':
        created += 1
        return { session_id: `created-${created}` }
      case 'session.title':
        chats[profile] = { sessionId: String(params.session_id), messages: [] }
        return { title: params.title }
      case 'session.resume':
        return {
          session_id: params.session_id,
          running: false,
          last_sequence: 7,
          ...(chat?.inflight ? { inflight: chat.inflight } : {}),
          ...(chat?.queued ? { queued: chat.queued } : {}),
          info: { model: '9-route-provider', provider: 'custom', reasoning_effort: 'medium' }
        }
      case 'GET /api/sessions':
        return { messages: chat?.messages ?? [] }
      case 'POST /api/chat/image-upload':
        return { path: '/images/pasted.png', mime_type: 'image/png' }
      case 'POST /api/audio/transcribe':
        return { transcript: 'dictated words' }
      case 'GET /api/model/options':
        if (profile === KEPT_ENDPOINT_PROFILE)
          return {
            providers: [
              { slug: 'custom', name: 'custom', is_current: true, models: ['9-route-provider'] },
              {
                slug: 'endpoint-router',
                name: 'Custom endpoint',
                is_user_defined: true,
                api_url: ROUTER_URL,
                models: ['9-route-provider', 'behind/the-router']
              }
            ]
          }
        return {
          providers: [
            {
              slug: 'custom',
              name: 'Router',
              is_user_defined: true,
              api_url: 'http://127.0.0.1:20128/v1/',
              models: ['9-route-provider', 'behind/the-router']
            },
            { slug: 'anthropic', name: 'Anthropic', models: ['claude-haiku'] }
          ]
        }
      case 'GET /api/providers/custom-endpoints':
        if (profile === KEPT_ENDPOINT_PROFILE)
          return {
            endpoints: [
              {
                id: 'custom',
                base_url: ROUTER_URL,
                source: 'direct-config',
                models: ['9-route-provider']
              },
              {
                id: 'endpoint-router',
                base_url: `${ROUTER_URL}/`,
                source: 'providers',
                models: ['9-route-provider']
              }
            ]
          }
        return {
          endpoints: [
            { id: 'custom', base_url: 'http://127.0.0.1:20128/v1', models: ['9-route-provider'] }
          ]
        }
      case 'GET /api/media':
        return goneMedia.has(String(params.file))
          ? null
          : { data_url: 'data:image/png;base64,AAAA' }
      default:
        return {}
    }
  }
  const held = async (method: string, run: () => unknown): Promise<unknown> => {
    const hold = holds.get(method)
    holds.delete(method)
    const value = run()
    await hold
    return value
  }
  const backend: ChatBackend = {
    request: async <T>(profile: string, method: string, params: Record<string, unknown> = {}) =>
      (await held(method, () => answer(profile, method, params))) as T,
    http: async <T>(request: EngineHttpRequest) => {
      const url = new URL(request.path, 'http://engine.invalid')
      const route = `${request.method ?? 'GET'} ${url.pathname.replace(/^(\/api\/sessions)\/.*/, '$1')}`
      const params = {
        ...Object.fromEntries(url.searchParams),
        ...((request.body as Record<string, unknown> | undefined) ?? {}),
        file: url.searchParams.get('path'),
        path: url.pathname
      }
      return (await held(route, () =>
        answer(url.searchParams.get('profile') ?? '', route, params)
      )) as T
    }
  }
  return {
    backend,
    calls,
    chats,
    goneMedia,
    failNext: (method, message) => failures.set(method, message),
    holdNext: (method) => {
      let release = (): void => undefined
      holds.set(method, new Promise<void>((resolve) => (release = resolve)))
      return () => release()
    }
  }
}
