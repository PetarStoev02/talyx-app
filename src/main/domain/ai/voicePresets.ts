import { join } from 'path'

export type VoiceModelChoice = 'fast' | 'accurate'

export interface VoicePreset {
  modelId: string
  /** Whether the spike found it usable for Bulgarian. */
  bulgarianReady: boolean
}

/** A Hugging Face repo plus the exact files a runtime needs from it. */
export interface ModelFiles {
  modelId: string
  files: readonly string[]
}

export const VOICE_PRESETS: Record<VoiceModelChoice, VoicePreset> = {
  fast: { modelId: 'onnx-community/whisper-base', bulgarianReady: false },
  accurate: { modelId: 'onnx-community/whisper-small', bulgarianReady: true }
}

/** The files whisper's `dtype: 'q8'` resolves to, verified against both repos on 2026-09-15. */
export const VOICE_MODEL_FILES = [
  'config.json',
  'generation_config.json',
  'preprocessor_config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'onnx/encoder_model_quantized.onnx',
  'onnx/decoder_model_merged_quantized.onnx'
] as const

export function whisperModelFiles(choice: VoiceModelChoice): ModelFiles {
  return { modelId: VOICE_PRESETS[choice].modelId, files: VOICE_MODEL_FILES }
}

/** Kokoro-82M, `dtype: 'q8'`; the four files transformers v4 pulls, measured 2026-09-15 (97 MB). */
export const KOKORO_MODEL: ModelFiles = {
  modelId: 'onnx-community/Kokoro-82M-v1.0-ONNX',
  files: ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'onnx/model_quantized.onnx']
}

/** The voices kokoro-js grades C or better, plus Lewis — Petar's pick. */
export const KOKORO_VOICES = [
  { id: 'bm_lewis', label: 'Lewis', accent: 'British', gender: 'male' },
  { id: 'bm_fable', label: 'Fable', accent: 'British', gender: 'male' },
  { id: 'bm_george', label: 'George', accent: 'British', gender: 'male' },
  { id: 'bm_daniel', label: 'Daniel', accent: 'British', gender: 'male' },
  { id: 'bf_emma', label: 'Emma', accent: 'British', gender: 'female' },
  { id: 'bf_isabella', label: 'Isabella', accent: 'British', gender: 'female' },
  { id: 'af_heart', label: 'Heart', accent: 'American', gender: 'female' },
  { id: 'af_bella', label: 'Bella', accent: 'American', gender: 'female' },
  { id: 'am_michael', label: 'Michael', accent: 'American', gender: 'male' },
  { id: 'am_fenrir', label: 'Fenrir', accent: 'American', gender: 'male' }
] as const

export type KokoroVoice = (typeof KOKORO_VOICES)[number]['id']
export const DEFAULT_KOKORO_VOICE: KokoroVoice = 'bm_lewis'

export function isKokoroVoice(value: string): value is KokoroVoice {
  return KOKORO_VOICES.some((voice) => voice.id === value)
}

/** Each voice is one 0.5 MB style-vector file beside the model. */
export function kokoroVoiceFiles(voice: KokoroVoice): ModelFiles {
  return { modelId: KOKORO_MODEL.modelId, files: [`voices/${voice}.bin`] }
}

/** `env.localModelPath` + `<modelId>` is where transformers looks. */
export function modelDir(modelsDir: string, model: ModelFiles): string {
  return join(modelsDir, model.modelId)
}

/** `exists` is injected so this stays free of `fs` and testable. */
export function missingModelFiles(
  modelsDir: string,
  model: ModelFiles,
  exists: (path: string) => boolean
): string[] {
  const dir = modelDir(modelsDir, model)
  return model.files.map((file) => join(dir, file)).filter((path) => !exists(path))
}

export function needsAccurateForBulgarian(choice: VoiceModelChoice, appLanguage: string): boolean {
  return appLanguage === 'bg' && !VOICE_PRESETS[choice].bulgarianReady
}
