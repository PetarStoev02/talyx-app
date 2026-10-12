import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { KOKORO_MODEL } from '../../../src/main/domain/ai/voicePresets'
import { phonemizeForKokoro } from '../../../src/main/infrastructure/voice/phonemizeForKokoro'

const MODELS_DIR = process.env.TALYX_TTS_MODEL_DIR

/**
 * Runs Kokoro for real. Skipped unless the model directory is exported, so CI never downloads 97 MB:
 *   TALYX_TTS_MODEL_DIR="$HOME/Library/Application Support/talyx/models/voice" npx vitest run tests/unit/voice/tts.integration.test.ts
 */
describe.skipIf(!MODELS_DIR)('Kokoro on the installed model', () => {
  it('should synthesise a sentence in Lewis at 24 kHz', { timeout: 120_000 }, async () => {
    const lib = await import('@huggingface/transformers')
    lib.env.allowRemoteModels = false
    lib.env.localModelPath = MODELS_DIR as string

    const [model, tokenizer] = await Promise.all([
      lib.StyleTextToSpeech2Model.from_pretrained(KOKORO_MODEL.modelId, { dtype: 'q8' }),
      lib.AutoTokenizer.from_pretrained(KOKORO_MODEL.modelId)
    ])
    const voiceBytes = readFileSync(
      join(MODELS_DIR as string, KOKORO_MODEL.modelId, 'voices', 'bm_lewis.bin')
    )
    const voice = new Float32Array(
      voiceBytes.buffer,
      voiceBytes.byteOffset,
      voiceBytes.byteLength / 4
    )

    const phonemes = await phonemizeForKokoro(
      'Tomorrow is clear. Nothing on your calendar.',
      'bm_lewis'
    )
    const { input_ids } = tokenizer(phonemes, { truncation: true })
    const tokens = Math.min(Math.max((input_ids.dims.at(-1) ?? 0) - 2, 0), 509)
    const style = new lib.Tensor('float32', voice.slice(256 * tokens, 256 * tokens + 256), [1, 256])
    const speed = new lib.Tensor('float32', [1], [1])

    const { waveform } = (await model({ input_ids, style, speed })) as {
      waveform: { data: Float32Array }
    }
    const seconds = waveform.data.length / 24000
    expect(seconds).toBeGreaterThan(1.5)
    expect(seconds).toBeLessThan(8)
  })
})
