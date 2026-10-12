import { join } from 'path'
import { unlinkSync, writeFileSync } from 'fs'
import log from 'electron-log'
import type { SpeechOutput } from './VoiceNarrator'
import type { Synth } from './TtsWorker'
import type { AudioPlayer } from './AfplayPlayer'
import { splitSentences } from './splitSentences'

export interface TempFiles {
  write(path: string, bytes: Uint8Array): void
  remove(path: string): void
}

export interface KokoroSpeakerDeps {
  synth: Synth
  player: AudioPlayer
  /** The `say` speaker: takes over the rest of a reply when Kokoro cannot. */
  fallback: SpeechOutput
  tempDir: string
  files?: TempFiles
  /** Drives the orb: true while a sentence is playing, false when the reply ends. */
  onSpeaking?: (speaking: boolean) => void
}

const FALLBACK_VOICE = 'Samantha'

const realFiles: TempFiles = {
  write: (path, bytes) => writeFileSync(path, bytes),
  remove: (path) => {
    try {
      unlinkSync(path)
    } catch {
      // already gone — stop() swept it, or afplay never got to it
    }
  }
}

/**
 * Sentence at a time: synthesise N+1 while N plays, so the first words land in
 * well under a second instead of after the whole reply is rendered.
 */
export class KokoroSpeaker implements SpeechOutput {
  private generation = 0
  private readonly files: TempFiles

  constructor(private readonly deps: KokoroSpeakerDeps) {
    this.files = deps.files ?? realFiles
  }

  speak(text: string, voice: string): void {
    // Cuts whatever is currently playing — Kokoro audio or a `say` fallback — before
    // starting the new reply, even if this text turns out to have no sentences.
    this.stop()
    const sentences = splitSentences(text)
    if (sentences.length === 0) return
    void this.run(this.generation, sentences, voice)
  }

  stop(): void {
    this.generation++
    this.deps.onSpeaking?.(false)
    this.deps.player.stop()
    this.deps.fallback.stop()
  }

  private async run(generation: number, sentences: string[], voice: string): Promise<void> {
    let playing: Promise<void> = Promise.resolve()

    for (let index = 0; index < sentences.length; index++) {
      const file = join(this.deps.tempDir, `talyx-tts-${generation}-${index}.wav`)
      try {
        const wav = await this.deps.synth.synthesize(sentences[index], voice)
        if (generation !== this.generation) return

        await playing
        if (generation !== this.generation) return

        // Inside the try: a failed temp write (full disk, unwritable temp dir) must hand
        // the rest of the reply to say, not escape run() as an unhandled rejection.
        this.files.write(file, wav)
        this.deps.onSpeaking?.(true)
        playing = this.deps.player.play(file).finally(() => this.files.remove(file))
      } catch (err) {
        if (generation !== this.generation) return
        log.warn('[KokoroSpeaker] synthesis failed, falling back to say:', err)
        // Waits for the sentence still playing to finish — say takes over the REST of
        // the reply, it doesn't talk over Kokoro's tail.
        await playing
        if (generation !== this.generation) return
        this.deps.fallback.speak(sentences.slice(index).join(' '), FALLBACK_VOICE)
        return
      }
    }

    await playing
    if (generation === this.generation) this.deps.onSpeaking?.(false)
  }
}
