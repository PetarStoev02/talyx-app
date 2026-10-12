export class InvalidAudioError extends Error {
  constructor(reason: string) {
    super(`Invalid audio: ${reason}`)
    this.name = 'InvalidAudioError'
  }
}

export interface DecodedWav {
  samples: Float32Array
  sampleRate: number
}

/** Whisper's only input rate; a caller that skips this silently mistranscribes. */
const WHISPER_SAMPLE_RATE = 16000

/** Accepts only a canonical 16 kHz, 16-bit mono RIFF/WAVE; rejects everything else loudly. */
export function decodeWav(bytes: Uint8Array): DecodedWav {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (bytes.byteLength < 44) throw new InvalidAudioError('too short to be a WAV')
  if (ascii(view, 0, 4) !== 'RIFF' || ascii(view, 8, 4) !== 'WAVE') {
    throw new InvalidAudioError('not a RIFF/WAVE file')
  }

  let sampleRate = 0
  let offset = 12
  while (offset + 8 <= bytes.byteLength) {
    const id = ascii(view, offset, 4)
    const size = view.getUint32(offset + 4, true)
    const body = offset + 8

    if (id === 'fmt ') {
      if (view.getUint16(body, true) !== 1) throw new InvalidAudioError('not PCM')
      if (view.getUint16(body + 2, true) !== 1) throw new InvalidAudioError('not mono')
      if (view.getUint16(body + 14, true) !== 16) throw new InvalidAudioError('not 16-bit')
      sampleRate = view.getUint32(body + 4, true)
      if (sampleRate !== WHISPER_SAMPLE_RATE) {
        throw new InvalidAudioError(`sample rate ${sampleRate}, expected ${WHISPER_SAMPLE_RATE}`)
      }
    } else if (id === 'data') {
      if (sampleRate === 0) throw new InvalidAudioError('data chunk before fmt chunk')
      const count = Math.min(size, bytes.byteLength - body) / 2
      const samples = new Float32Array(Math.floor(count))
      for (let i = 0; i < samples.length; i++) {
        samples[i] = view.getInt16(body + i * 2, true) / 32768
      }
      return { samples, sampleRate }
    }
    offset = body + size + (size % 2) // chunks are word-aligned
  }
  throw new InvalidAudioError('no data chunk')
}

/** Main-process code has Buffer; skip the byte-by-byte loop the renderer needs without it. */
function ascii(view: DataView, offset: number, length: number): string {
  return Buffer.from(view.buffer, view.byteOffset + offset, length).toString('latin1')
}
