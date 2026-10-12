export type VoiceErrorKey =
  | 'voice_permission_denied'
  | 'voice_no_speech'
  | 'voice_model_missing'
  | 'voice_failed'

export type VoiceModelChoice = 'fast' | 'accurate'

export interface VoiceModelStatus {
  choice: VoiceModelChoice
  installed: boolean
  needsAccurateForBulgarian: boolean
}

export interface VoiceDownloadProgress {
  percent: number
}

export type TtsEngine = 'kokoro' | 'system'

export interface TtsStatus {
  engine: TtsEngine
  voice: string
  modelInstalled: boolean
  voices: { id: string; label: string; accent: string; gender: string }[]
}

const ERROR_KEYS: VoiceErrorKey[] = [
  'voice_permission_denied',
  'voice_model_missing',
  'voice_no_speech',
  'voice_failed'
]

/** IPC flattens a thrown SttError into a message; recover the key from it. */
export function voiceErrorKey(message: string): VoiceErrorKey {
  return ERROR_KEYS.find((key) => message.includes(key)) ?? 'voice_failed'
}

export const voiceApi = {
  permission: (): Promise<{ granted: boolean }> =>
    window.api.voicePermission() as Promise<{ granted: boolean }>,
  transcribe: (wavBase64: string): Promise<{ text: string }> =>
    window.api.voiceTranscribe(wavBase64) as Promise<{ text: string }>,
  modelStatus: (): Promise<VoiceModelStatus> =>
    window.api.voiceModelStatus() as Promise<VoiceModelStatus>,
  downloadModel: (choice: VoiceModelChoice): Promise<{ success: boolean; error?: string }> =>
    window.api.voiceDownloadModel(choice) as Promise<{ success: boolean; error?: string }>,
  ttsStatus: (): Promise<TtsStatus> => window.api.voiceTtsStatus() as Promise<TtsStatus>,
  downloadTts: (): Promise<{ success: boolean; error?: string }> =>
    window.api.voiceDownloadTts() as Promise<{ success: boolean; error?: string }>,
  previewVoice: (voice: string): Promise<void> =>
    window.api.voicePreviewVoice(voice).then(() => undefined),
  onSpeaking: (callback: (speaking: boolean) => void): (() => void) =>
    window.api.onVoiceSpeaking(callback),
  onDownloadProgress: (callback: (progress: VoiceDownloadProgress) => void): (() => void) =>
    window.api.onVoiceDownloadProgress(callback)
}
