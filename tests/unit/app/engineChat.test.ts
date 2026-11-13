import { describe, expect, it } from 'vitest'
import type { EngineAccess } from '../../../src/renderer/src/app/engine/access'
import { engineChatBackend } from '../../../src/renderer/src/app/engine/chat'
import type { EngineApiRequest } from '../../../src/renderer/src/shared/engine/http'

// The chat's wiring: what each Talyx operation asks of the engine, and what it reads back.
function engineAnswering(answer: unknown): { engine: EngineAccess; sent: EngineApiRequest[] } {
  const sent: EngineApiRequest[] = []
  const engine: EngineAccess = {
    request: async () => {
      throw new Error('no socket request expected')
    },
    http: async <T>(request: EngineApiRequest) => {
      sent.push(request)
      return answer as T
    }
  }
  return { engine, sent }
}

describe('engine chat backend', () => {
  describe('createChat', () => {
    it('should keep a title refusal other than the race and look for no other chat', async () => {
      const methods: string[] = []
      const engine: EngineAccess = {
        request: async <T>(_profile: string, method: string): Promise<T> => {
          methods.push(method)
          if (method === 'session.title') throw new Error('Gateway restarting')
          return { session_id: 'created' } as T
        },
        http: async () => {
          throw new Error('no REST call expected')
        }
      }

      await expect(engineChatBackend(engine).createChat('acme')).rejects.toThrow(
        'Gateway restarting'
      )
      expect(methods).toEqual(['session.create', 'session.title'])
    })
  })

  describe('transcribe', () => {
    it('should post the recording for the profile and return its words', async () => {
      const { engine, sent } = engineAnswering({ transcript: 'dictated words' })

      const words = await engineChatBackend(engine).transcribe('acme manager', {
        dataUrl: 'data:audio/webm;base64,AA',
        mime: 'audio/webm'
      })

      expect(words).toBe('dictated words')
      expect(sent).toEqual([
        {
          path: '/api/audio/transcribe?profile=acme%20manager',
          method: 'POST',
          body: { data_url: 'data:audio/webm;base64,AA', mime_type: 'audio/webm' },
          profile: 'acme manager'
        }
      ])
    })
  })
})
