import { spawn, type ChildProcess } from 'child_process'
import log from 'electron-log'
import type { SpeechOutput } from './VoiceNarrator'

const WORDS_PER_MINUTE = '190'

/** macOS `say`, one utterance at a time. A no-op everywhere else. */
export class Speaker implements SpeechOutput {
  private child: ChildProcess | null = null

  /** `onSpeaking` drives the orb: true while a `say` child is alive, false when it is not. */
  constructor(private readonly onSpeaking: (speaking: boolean) => void = () => {}) {}

  speak(text: string, voice: string): void {
    this.stop()
    if (process.platform !== 'darwin') return

    try {
      // Text goes in over stdin: no shell, no quoting, no argument-length ceiling.
      const child = spawn('say', ['-v', voice, '-r', WORDS_PER_MINUTE])
      child.on('error', (err) => log.warn('[Speaker] say failed:', err))
      child.on('exit', () => {
        if (this.child === child) {
          this.child = null
          this.onSpeaking(false)
        }
      })
      // `say` can exit before or during the write (e.g. killed by the next speak()); an
      // unhandled 'error' on stdin would otherwise crash the main process.
      child.stdin?.on('error', (err) => log.warn('[Speaker] stdin write failed:', err))
      child.stdin?.end(text)
      this.child = child
      this.onSpeaking(true)
    } catch (err) {
      log.warn('[Speaker] could not spawn say:', err)
    }
  }

  stop(): void {
    this.child?.kill()
    this.child = null
    this.onSpeaking(false)
  }
}
