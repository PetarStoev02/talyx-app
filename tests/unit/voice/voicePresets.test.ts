import { describe, it, expect } from 'vitest'
import {
  VOICE_MODEL_FILES,
  modelDir,
  missingModelFiles,
  needsAccurateForBulgarian,
  whisperModelFiles
} from '../../../src/main/domain/ai/voicePresets'

describe('voicePresets', () => {
  it('should ship the quantized encoder and merged decoder transformers asks for', () => {
    expect(VOICE_MODEL_FILES).toContain('onnx/encoder_model_quantized.onnx')
    expect(VOICE_MODEL_FILES).toContain('onnx/decoder_model_merged_quantized.onnx')
    expect(VOICE_MODEL_FILES).toContain('tokenizer.json')
    expect(VOICE_MODEL_FILES).toContain('preprocessor_config.json')
  })

  it('should place a model where env.localModelPath will find it', () => {
    expect(modelDir('/data/models/voice', whisperModelFiles('fast'))).toBe(
      '/data/models/voice/onnx-community/whisper-base'
    )
  })

  it('should report nothing missing when every file is present', () => {
    expect(missingModelFiles('/data/models/voice', whisperModelFiles('fast'), () => true)).toEqual(
      []
    )
  })

  it('should name the missing files when the install is partial', () => {
    const exists = (path: string): boolean => !path.endsWith('tokenizer.json')
    expect(missingModelFiles('/data/models/voice', whisperModelFiles('fast'), exists)).toEqual([
      '/data/models/voice/onnx-community/whisper-base/tokenizer.json'
    ])
  })

  it('should flag Bulgarian on the fast model only', () => {
    expect(needsAccurateForBulgarian('fast', 'bg')).toBe(true)
    expect(needsAccurateForBulgarian('accurate', 'bg')).toBe(false)
    expect(needsAccurateForBulgarian('fast', 'en')).toBe(false)
  })
})
