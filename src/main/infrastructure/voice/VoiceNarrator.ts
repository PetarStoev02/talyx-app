import type { OverlayEvent } from '../../domain/agent/AgentSession'
import { markdownToSpeech } from './markdownToSpeech'

export interface SpeechOutput {
  speak(text: string, voice: string): void
  stop(): void
}

const VOICE_BY_LANGUAGE: Record<string, string> = { bg: 'Daria' }
const DEFAULT_VOICE = 'Samantha'

/** Every rule about what Talyx says out loud, in one object that takes a fake in tests. */
export class VoiceNarrator {
  constructor(
    private readonly speaker: SpeechOutput,
    private readonly settings: () => {
      voiceSpeakReplies: boolean
      /** Voice mode answers out loud instead of on screen, so it implies speech. */
      voiceMode: boolean
      appLanguage: string
    }
  ) {}

  observe(event: OverlayEvent): void {
    switch (event.type) {
      case 'text':
        if (event.interim || !this.speechEnabled()) return
        this.say(event.text)
        return
      // A card is a decision, not a monologue: Talyx goes quiet and waits.
      // Unconditional: flipping the setting off mid-utterance must still cut off speech.
      case 'approval':
      case 'error':
        this.speaker.stop()
        return
      // done always follows the final text in the same tick — stopping here would
      // kill the reply we just started speaking. Silence comes from abort/kill via stop().
      default:
        return
    }
  }

  private speechEnabled(): boolean {
    const { voiceSpeakReplies, voiceMode } = this.settings()
    return voiceSpeakReplies || voiceMode
  }

  /** The explicit "shut up now" — used by abort and the kill switch. */
  stop(): void {
    this.speaker.stop()
  }

  private say(markdown: string): void {
    const text = markdownToSpeech(markdown)
    if (text.length === 0) return
    this.speaker.speak(text, VOICE_BY_LANGUAGE[this.settings().appLanguage] ?? DEFAULT_VOICE)
  }
}
