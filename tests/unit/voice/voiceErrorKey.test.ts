import { describe, it, expect } from 'vitest'
import { voiceErrorKey, type VoiceErrorKey } from '../../../src/renderer/src/shared/api/voice'

const KEYS: VoiceErrorKey[] = [
  'voice_permission_denied',
  'voice_model_missing',
  'voice_no_speech',
  'voice_failed'
]

describe('voiceErrorKey', () => {
  it.each(KEYS)('should recover %s from its "key: message" IPC string', (key) => {
    expect(voiceErrorKey(`${key}: something went wrong`)).toBe(key)
  })

  it('should fall back to voice_failed for an unrecognized message', () => {
    expect(voiceErrorKey('ENOENT: no such file or directory')).toBe('voice_failed')
  })

  it('should still resolve a key that appears mid-string', () => {
    expect(voiceErrorKey('Error: voice_no_speech: transcript was empty')).toBe('voice_no_speech')
  })
})
