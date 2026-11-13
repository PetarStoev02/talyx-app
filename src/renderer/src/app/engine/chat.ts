import type { ChatBackend } from '@features/chat/chat'
import type { EngineAccess } from './access'

/** The chat's backend over the engine. */
export function engineChatBackend(engine: EngineAccess): ChatBackend {
  return {
    request: engine.request,
    http: engine.http,
    transcribe: async (profile, { dataUrl, mime }) => {
      const { transcript } = await engine.http<{ transcript: string }>({
        path: `/api/audio/transcribe?profile=${encodeURIComponent(profile)}`,
        method: 'POST',
        body: { data_url: dataUrl, mime_type: mime },
        profile
      })
      return transcript
    }
  }
}
