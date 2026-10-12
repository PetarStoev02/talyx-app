import { ipcMain, systemPreferences } from 'electron'
import { join } from 'path'
import log from 'electron-log'
import {
  validateInput,
  VoiceModelChoiceSchema,
  VoiceTranscribeSchema,
  KokoroVoiceSchema
} from './validation'
import { decodeWav } from '../voice/wav'
import { isNoiseTranscript } from '../voice/isNoiseTranscript'
import { SttError, SttWorker } from '../voice/SttWorker'
import { VoiceModelInstaller } from '../voice/VoiceModelInstaller'
import type { SpeechOutput } from '../voice/VoiceNarrator'
import {
  VOICE_PRESETS,
  KOKORO_MODEL,
  KOKORO_VOICES,
  needsAccurateForBulgarian,
  whisperModelFiles,
  isKokoroVoice,
  kokoroVoiceFiles,
  type VoiceModelChoice
} from '../../domain/ai/voicePresets'
import type { SettingsStore } from '../storage/SettingsStore'

export interface VoiceModelStatus {
  choice: VoiceModelChoice
  installed: boolean
  needsAccurateForBulgarian: boolean
}

export interface TtsStatus {
  engine: 'kokoro' | 'system'
  voice: string
  modelInstalled: boolean
  voices: { id: string; label: string; accent: string; gender: string }[]
}

export function registerVoiceIpc(deps: { settingsStore: SettingsStore; modelsDir: string }): {
  dispose: () => void
  kokoroReady: () => boolean
  ensureVoice: (voice: string) => Promise<void>
  voiceModelsDir: string
  setPreviewSpeaker: (speaker: SpeechOutput) => void
} {
  const voiceModelsDir = join(deps.modelsDir, 'voice')
  const installer = new VoiceModelInstaller(voiceModelsDir)
  let stt: SttWorker | null = null
  /** The choice the live worker was built for; changing it in Settings starts over. */
  let sttChoice: VoiceModelChoice | null = null
  // Set by index.ts once the Kokoro speaker exists; Task 7's preview handler reads it.
  let previewSpeaker: SpeechOutput | null = null

  function ensureStt(choice: VoiceModelChoice): SttWorker {
    if (stt && sttChoice !== choice) {
      stt.dispose()
      stt = null
    }
    if (!stt) {
      stt = new SttWorker({
        modelId: VOICE_PRESETS[choice].modelId,
        modelsDir: voiceModelsDir
      })
      sttChoice = choice
    }
    return stt
  }

  /** Fetches the selected voice's 0.5 MB style file if it is not already on disk. */
  async function ensureVoice(voice: string): Promise<void> {
    if (!isKokoroVoice(voice)) throw new Error(`unknown voice ${voice}`)
    const files = kokoroVoiceFiles(voice)
    if (!installer.isInstalled(files)) await installer.install(files, () => {})
  }

  ipcMain.handle('voice:permission', async () => {
    if (process.platform !== 'darwin') return { granted: true }
    const granted = await systemPreferences.askForMediaAccess('microphone')
    return { granted }
  })

  ipcMain.handle('voice:model-status', (): VoiceModelStatus => {
    const settings = deps.settingsStore.store
    const choice = settings.voiceSttModel
    return {
      choice,
      installed: installer.isInstalled(whisperModelFiles(choice)),
      needsAccurateForBulgarian: needsAccurateForBulgarian(choice, settings.appLanguage)
    }
  })

  ipcMain.handle('voice:download-model', async (event, raw: unknown) => {
    const { choice } = validateInput(VoiceModelChoiceSchema, raw)
    try {
      await installer.install(whisperModelFiles(choice), (percent) => {
        if (!event.sender.isDestroyed()) event.sender.send('voice:download-progress', { percent })
      })
      return { success: true }
    } catch (err) {
      log.warn('[voice:download-model] failed:', err)
      return { success: false, error: err instanceof Error ? err.message : 'Download failed' }
    }
  })

  ipcMain.handle('voice:transcribe', async (_event, raw: unknown) => {
    const settings = deps.settingsStore.store
    const choice = settings.voiceSttModel

    if (!installer.isInstalled(whisperModelFiles(choice))) {
      throw new Error('voice_model_missing: no voice model installed')
    }

    try {
      const { wavBase64 } = validateInput(VoiceTranscribeSchema, raw)
      const { samples } = decodeWav(new Uint8Array(Buffer.from(wavBase64, 'base64')))
      const text = await ensureStt(choice).transcribe(samples, settings.appLanguage)
      if (isNoiseTranscript(text)) {
        throw new SttError('voice_no_speech', 'transcript matched a whisper silence artifact')
      }
      return { text }
    } catch (err) {
      const key = err instanceof SttError ? err.key : 'voice_failed'
      const message = err instanceof Error ? err.message : 'transcription failed'
      throw new Error(`${key}: ${message}`)
    }
  })

  ipcMain.handle('voice:tts-status', (): TtsStatus => {
    const settings = deps.settingsStore.store
    return {
      engine: settings.voiceTtsEngine,
      voice: settings.voiceTtsVoice,
      modelInstalled: installer.isInstalled(KOKORO_MODEL),
      voices: KOKORO_VOICES.map((v) => ({ ...v }))
    }
  })

  /** Installs the model and the currently selected voice; progress on the same channel as whisper. */
  ipcMain.handle('voice:download-tts', async (event) => {
    const voice = deps.settingsStore.store.voiceTtsVoice
    const report = (percent: number): void => {
      if (!event.sender.isDestroyed()) event.sender.send('voice:download-progress', { percent })
    }
    try {
      await installer.install(KOKORO_MODEL, (percent) => report(Math.round(percent * 0.95)))
      await installer.install(kokoroVoiceFiles(voice), () => {})
      report(100)
      return { success: true }
    } catch (err) {
      log.warn('[voice:download-tts] failed:', err)
      return { success: false, error: err instanceof Error ? err.message : 'Download failed' }
    }
  })

  /** Speaks one fixed sentence in the given voice — the only honest way to pick one. */
  ipcMain.handle('voice:preview-voice', async (_event, raw: unknown) => {
    const { voice } = validateInput(KokoroVoiceSchema, raw)
    if (!previewSpeaker || !installer.isInstalled(KOKORO_MODEL)) {
      throw new Error('voice_model_missing: install the Kokoro model first')
    }
    await ensureVoice(voice)
    const label = KOKORO_VOICES.find((v) => v.id === voice)?.label ?? voice
    previewSpeaker.speak(`Hi, I'm ${label}. This is how I'll sound when Talyx answers you.`, voice)
    return { started: true }
  })

  return {
    dispose: () => {
      stt?.dispose()
      stt = null
      previewSpeaker?.stop()
      previewSpeaker = null
    },
    kokoroReady: () => installer.isInstalled(KOKORO_MODEL),
    ensureVoice,
    voiceModelsDir,
    setPreviewSpeaker: (speaker) => {
      previewSpeaker = speaker
    }
  }
}
