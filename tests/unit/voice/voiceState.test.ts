import { describe, it, expect } from 'vitest'
import {
  initialVoiceState,
  isSilent,
  voiceReducer,
  MIN_UTTERANCE_MS,
  MAX_UTTERANCE_MS,
  type VoiceState
} from '../../../src/renderer/src/features/assistant/voice/voiceState'

const listening: VoiceState = { phase: 'listening', level: 0, error: null, transcript: null }

describe('voiceReducer', () => {
  it('should ask for the microphone on the first press', () => {
    expect(voiceReducer(initialVoiceState, { type: 'press' }).phase).toBe('requesting')
  })

  it('should clear the previous error when a new press starts', () => {
    const failed: VoiceState = { phase: 'idle', level: 0, error: 'voice_failed', transcript: null }
    expect(voiceReducer(failed, { type: 'press' }).error).toBeNull()
  })

  it('should start listening once the microphone is granted', () => {
    const requesting = voiceReducer(initialVoiceState, { type: 'press' })
    expect(voiceReducer(requesting, { type: 'granted' }).phase).toBe('listening')
  })

  it('should report a denied microphone and return to idle', () => {
    const requesting = voiceReducer(initialVoiceState, { type: 'press' })
    const denied = voiceReducer(requesting, { type: 'denied' })
    expect(denied).toEqual({
      phase: 'idle',
      level: 0,
      error: 'voice_permission_denied',
      transcript: null
    })
  })

  it('should drop an utterance shorter than the minimum without an error', () => {
    const released = voiceReducer(listening, { type: 'release', durationMs: MIN_UTTERANCE_MS - 1 })
    expect(released).toEqual(initialVoiceState)
  })

  it('should transcribe an utterance at or over the minimum', () => {
    const released = voiceReducer(listening, { type: 'release', durationMs: MIN_UTTERANCE_MS })
    expect(released.phase).toBe('transcribing')
  })

  it('should transcribe an utterance that hit the 60s ceiling, same as any other release', () => {
    const released = voiceReducer(listening, { type: 'release', durationMs: MAX_UTTERANCE_MS })
    expect(released.phase).toBe('transcribing')
  })

  it('should track the level only while listening', () => {
    expect(voiceReducer(listening, { type: 'level', level: 0.4 }).level).toBe(0.4)
    expect(voiceReducer(initialVoiceState, { type: 'level', level: 0.4 }).level).toBe(0)
  })

  it('should ignore a press that arrives while busy', () => {
    const transcribing: VoiceState = {
      phase: 'transcribing',
      level: 0,
      error: null,
      transcript: null
    }
    expect(voiceReducer(transcribing, { type: 'press' })).toBe(transcribing)
    expect(voiceReducer(listening, { type: 'press' })).toBe(listening)
  })

  it('should carry the transcript text and return to idle', () => {
    const transcribing: VoiceState = {
      phase: 'transcribing',
      level: 0,
      error: null,
      transcript: null
    }
    const done = voiceReducer(transcribing, { type: 'transcript', text: 'what is on my calendar' })
    expect(done).toEqual({ ...initialVoiceState, transcript: 'what is on my calendar' })
  })

  it('should record a failure key and return to idle', () => {
    const transcribing: VoiceState = {
      phase: 'transcribing',
      level: 0,
      error: null,
      transcript: null
    }
    const failed = voiceReducer(transcribing, { type: 'failed', key: 'voice_model_missing' })
    expect(failed).toEqual({
      phase: 'idle',
      level: 0,
      error: 'voice_model_missing',
      transcript: null
    })
  })

  it('should cancel from any phase', () => {
    expect(voiceReducer(listening, { type: 'cancel' })).toEqual(initialVoiceState)
  })
})

describe('isSilent', () => {
  it('should treat true silence as silent', () => {
    expect(isSilent(new Float32Array(16000))).toBe(true)
  })

  it('should treat an empty clip as silent', () => {
    expect(isSilent(new Float32Array(0))).toBe(true)
  })

  it('should treat mic self-noise dither as silent', () => {
    const dither = new Float32Array(16000)
    for (let i = 0; i < dither.length; i++) dither[i] = i % 2 === 0 ? -1 / 32768 : 1 / 32768
    expect(isSilent(dither)).toBe(true)
  })

  it('should not treat a normal-volume voice as silent', () => {
    const sine = new Float32Array(16000)
    for (let i = 0; i < sine.length; i++) sine[i] = 0.2 * Math.sin(i / 10)
    expect(isSilent(sine)).toBe(false)
  })
})
