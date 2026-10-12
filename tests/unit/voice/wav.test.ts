import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { encodeWav } from '../../../src/renderer/src/features/assistant/voice/wav'
import { decodeWav, InvalidAudioError } from '../../../src/main/infrastructure/voice/wav'

const FIXTURES = join(__dirname, '../../fixtures/voice')

function ramp(length: number): Float32Array {
  const samples = new Float32Array(length)
  for (let i = 0; i < length; i++) samples[i] = Math.sin((i / length) * Math.PI * 2)
  return samples
}

describe('encodeWav / decodeWav', () => {
  it('should round-trip samples within 16-bit precision', () => {
    const original = ramp(1600)
    const decoded = decodeWav(encodeWav(original, 16000))

    expect(decoded.sampleRate).toBe(16000)
    expect(decoded.samples).toHaveLength(1600)
    for (let i = 0; i < original.length; i++) {
      expect(Math.abs(decoded.samples[i] - original[i])).toBeLessThan(0.0001)
    }
  })

  it('should clamp samples outside -1..1 instead of wrapping', () => {
    const decoded = decodeWav(encodeWav(Float32Array.from([2, -2]), 16000))
    expect(decoded.samples[0]).toBeCloseTo(1, 3)
    expect(decoded.samples[1]).toBeCloseTo(-1, 3)
  })

  it('should write a 44-byte canonical header', () => {
    const bytes = encodeWav(ramp(10), 16000)
    expect(bytes).toHaveLength(44 + 20)
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('RIFF')
    expect(new TextDecoder().decode(bytes.slice(8, 12))).toBe('WAVE')
  })

  it('should reject bytes that are not a WAV', () => {
    expect(() => decodeWav(new Uint8Array(64))).toThrow(InvalidAudioError)
  })

  it('should decode the recorded fixtures as 16 kHz mono', () => {
    for (const name of ['en-calendar.wav', 'bg-calendar.wav']) {
      const decoded = decodeWav(new Uint8Array(readFileSync(join(FIXTURES, name))))
      expect(decoded.sampleRate).toBe(16000)
      expect(decoded.samples.length).toBeGreaterThan(16000 * 0.5)
      expect(decoded.samples.length).toBeLessThan(16000 * 10)
    }
  })

  it('should reject a sample rate whisper was not built for', () => {
    expect(() => decodeWav(encodeWav(ramp(160), 44100))).toThrow(InvalidAudioError)
  })
})
