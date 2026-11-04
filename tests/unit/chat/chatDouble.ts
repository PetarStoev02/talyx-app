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
  // Every Bot Chat by profile: [session id, its stored messages].
  chats: Record<string, { sessionId: string; messages: SessionMessage[] }>
  failNext: (method: string, message: string) => void
}

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
        return { session_id: params.session_id, running: false, last_sequence: 7 }
      case 'GET /api/sessions':
        return { messages: chat?.messages ?? [] }
      case 'POST /api/chat/image-upload':
        return { path: '/images/pasted.png', mime_type: 'image/png' }
      case 'POST /api/audio/transcribe':
        return { transcript: 'dictated words' }
      case 'GET /api/media':
        return { data_url: 'data:image/png;base64,AAAA' }
      default:
        return {}
    }
  }
  const backend: ChatBackend = {
    request: async <T>(profile: string, method: string, params: Record<string, unknown> = {}) =>
      answer(profile, method, params) as T,
    http: async <T>(request: EngineHttpRequest) => {
      const url = new URL(request.path, 'http://engine.invalid')
      const route = `${request.method ?? 'GET'} ${url.pathname.replace(/^(\/api\/sessions)\/.*/, '$1')}`
      const params = {
        ...Object.fromEntries(url.searchParams),
        ...((request.body as Record<string, unknown> | undefined) ?? {}),
        path: url.pathname
      }
      return answer(url.searchParams.get('profile') ?? '', route, params) as T
    }
  }
  return {
    backend,
    calls,
    chats,
    failNext: (method, message) => failures.set(method, message)
  }
}
