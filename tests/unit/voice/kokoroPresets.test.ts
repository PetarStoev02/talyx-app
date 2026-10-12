import { describe, it, expect } from 'vitest'
import {
  KOKORO_MODEL,
  KOKORO_VOICES,
  DEFAULT_KOKORO_VOICE,
  kokoroVoiceFiles,
  modelDir,
  missingModelFiles,
  whisperModelFiles
} from '../../../src/main/domain/ai/voicePresets'

describe('Kokoro presets', () => {
  it('should describe the q8 model as the four files transformers pulls', () => {
    expect(KOKORO_MODEL.modelId).toBe('onnx-community/Kokoro-82M-v1.0-ONNX')
    expect([...KOKORO_MODEL.files]).toEqual([
      'config.json',
      'tokenizer.json',
      'tokenizer_config.json',
      'onnx/model_quantized.onnx'
    ])
  })

  it('should offer ten voices with unique ids and Lewis as the default', () => {
    expect(KOKORO_VOICES).toHaveLength(10)
    expect(new Set(KOKORO_VOICES.map((v) => v.id)).size).toBe(10)
    expect(DEFAULT_KOKORO_VOICE).toBe('bm_lewis')
    expect(KOKORO_VOICES.find((v) => v.id === 'bm_lewis')?.label).toBe('Lewis')
  })

  it('should locate a voice file inside the model directory', () => {
    const files = kokoroVoiceFiles('bm_lewis')
    expect(files.modelId).toBe(KOKORO_MODEL.modelId)
    expect([...files.files]).toEqual(['voices/bm_lewis.bin'])
    expect(modelDir('/m', files)).toBe('/m/onnx-community/Kokoro-82M-v1.0-ONNX')
  })

  it('should express the whisper presets in the same shape', () => {
    expect(whisperModelFiles('fast').modelId).toBe('onnx-community/whisper-base')
    expect(whisperModelFiles('fast').files).toContain('onnx/encoder_model_quantized.onnx')
  })

  it('should list only the missing files', () => {
    const exists = (p: string): boolean => !p.endsWith('tokenizer.json')
    expect(missingModelFiles('/m', KOKORO_MODEL, exists)).toEqual([
      '/m/onnx-community/Kokoro-82M-v1.0-ONNX/tokenizer.json'
    ])
  })
})
