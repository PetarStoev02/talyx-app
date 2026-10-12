import type { VoiceErrorKey } from '@shared/api/voice'

export type VoicePhase = 'idle' | 'requesting' | 'listening' | 'transcribing'

export interface VoiceState {
  phase: VoicePhase
  /** 0..1 loudness for the waveform; meaningful only while listening. */
  level: number
  error: VoiceErrorKey | null
  /** The finished utterance waiting to be consumed by InstructionInput; cleared by consumeTranscript(). */
  transcript: string | null
}

export type VoiceEvent =
  | { type: 'press' }
  | { type: 'granted' }
  | { type: 'denied' }
  | { type: 'level'; level: number }
  | { type: 'release'; durationMs: number }
  | { type: 'transcript'; text: string }
  | { type: 'failed'; key: VoiceErrorKey }
  | { type: 'cancel' }

/** Shorter than this is a mis-press, not an utterance. */
export const MIN_UTTERANCE_MS = 300
/** A held key that is never released still ends. */
export const MAX_UTTERANCE_MS = 60_000

/**
 * Below this RMS the clip is room noise, not speech — measured against
 * tests/fixtures/voice/*.wav (~0.18 RMS) vs. true/dithered silence (~0.00003 RMS);
 * 0.01 leaves >10x headroom on both sides. Below it whisper hallucinates words
 * ("you", "thank you for watching") instead of returning an empty transcript.
 */
export const SILENCE_RMS = 0.01

export const initialVoiceState: VoiceState = {
  phase: 'idle',
  level: 0,
  error: null,
  transcript: null
}

/** Sending a near-silent clip to the model wastes work and risks a hallucinated transcript. */
export function isSilent(samples: Float32Array): boolean {
  if (samples.length === 0) return true
  let sum = 0
  for (const sample of samples) sum += sample * sample
  return Math.sqrt(sum / samples.length) < SILENCE_RMS
}

export function voiceReducer(state: VoiceState, event: VoiceEvent): VoiceState {
  switch (event.type) {
    case 'press':
      if (state.phase !== 'idle') return state
      return { phase: 'requesting', level: 0, error: null, transcript: null }
    case 'granted':
      if (state.phase !== 'requesting') return state
      return { ...state, phase: 'listening' }
    case 'denied':
      return { phase: 'idle', level: 0, error: 'voice_permission_denied', transcript: null }
    case 'level':
      if (state.phase !== 'listening') return state
      return { ...state, level: event.level }
    case 'release':
      if (state.phase !== 'listening') return state
      if (event.durationMs < MIN_UTTERANCE_MS) return initialVoiceState
      return { phase: 'transcribing', level: 0, error: null, transcript: null }
    case 'transcript':
      return { ...initialVoiceState, transcript: event.text }
    case 'failed':
      return { phase: 'idle', level: 0, error: event.key, transcript: null }
    case 'cancel':
      return initialVoiceState
  }
}
