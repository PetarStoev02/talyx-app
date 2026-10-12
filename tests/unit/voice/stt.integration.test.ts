import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { decodeWav } from '../../../src/main/infrastructure/voice/wav'

const MODELS_DIR = process.env.TALYX_STT_MODEL_DIR
const MODEL_ID = process.env.TALYX_STT_MODEL_ID ?? 'onnx-community/whisper-base'

/**
 * Runs whisper for real against the spoken fixture. Skipped unless a model
 * directory is exported, so CI never downloads 80 MB:
 *   TALYX_STT_MODEL_DIR=~/Library/Application\ Support/talyx/models/voice npx vitest run tests/unit/voice/stt.integration.test.ts
 */
describe.skipIf(!MODELS_DIR)('whisper on the recorded fixture', () => {
  it('should transcribe the English fixture', { timeout: 120_000 }, async () => {
    const { pipeline, env } = await import('@huggingface/transformers')
    env.allowRemoteModels = false
    env.localModelPath = MODELS_DIR as string

    const transcribe = await pipeline('automatic-speech-recognition', MODEL_ID, { dtype: 'q8' })
    const wav = new Uint8Array(
      readFileSync(join(__dirname, '../../fixtures/voice/en-calendar.wav'))
    )
    const { samples } = decodeWav(wav)

    const output = (await transcribe(samples, {
      language: 'en',
      task: 'transcribe',
      chunk_length_s: 30
    })) as { text: string }

    expect(output.text.toLowerCase()).toContain('calendar')
  })
})
