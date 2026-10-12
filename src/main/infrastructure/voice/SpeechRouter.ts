import log from 'electron-log'
import type { SpeechOutput } from './VoiceNarrator'

export interface SpeechRouterDeps {
  kokoro: SpeechOutput
  system: SpeechOutput
  settings: () => {
    voiceTtsEngine: 'kokoro' | 'system'
    voiceTtsVoice: string
    appLanguage: string
  }
  /** Whether the Kokoro model files are on disk. */
  kokoroReady: () => boolean
  /** Fetches the selected voice's 0.5 MB file if it is not there yet. */
  ensureVoice: (voice: string) => Promise<void>
  platform?: string
}

/** Which voice speaks: Kokoro when it can, `say` for everything else — and always for Bulgarian. */
export class SpeechRouter implements SpeechOutput {
  private generation = 0

  constructor(private readonly deps: SpeechRouterDeps) {}

  speak(text: string, voice: string): void {
    const generation = ++this.generation
    const { voiceTtsEngine, voiceTtsVoice, appLanguage } = this.deps.settings()
    const platform = this.deps.platform ?? process.platform

    const useKokoro =
      voiceTtsEngine === 'kokoro' &&
      appLanguage !== 'bg' &&
      platform === 'darwin' &&
      this.deps.kokoroReady()

    if (!useKokoro) {
      this.speakWithSystem(text, voice)
      return
    }

    this.deps
      .ensureVoice(voiceTtsVoice)
      .then(() => {
        if (generation !== this.generation) return
        this.deps.kokoro.speak(text, voiceTtsVoice)
      })
      .catch((err: unknown) => {
        if (generation !== this.generation) return
        log.warn('[SpeechRouter] voice unavailable, using say:', err)
        this.speakWithSystem(text, voice)
      })
  }

  /**
   * Kokoro is stopped first: switching engine or language mid-reply must hand over,
   * not add a second voice on top of the sentences still queued.
   */
  private speakWithSystem(text: string, voice: string): void {
    this.deps.kokoro.stop()
    this.deps.system.speak(text, voice)
  }

  stop(): void {
    this.generation++
    this.deps.kokoro.stop()
    this.deps.system.stop()
  }
}
