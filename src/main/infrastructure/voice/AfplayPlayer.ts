import { spawn, type ChildProcess } from 'child_process'
import log from 'electron-log'

export interface AudioPlayer {
  /** Resolves when playback ends — or immediately after stop(). */
  play(file: string): Promise<void>
  stop(): void
}

/** macOS `afplay`, one file at a time. */
export class AfplayPlayer implements AudioPlayer {
  private child: ChildProcess | null = null

  play(file: string): Promise<void> {
    this.stop()
    return new Promise<void>((resolve) => {
      try {
        const child = spawn('afplay', [file])
        child.on('error', (err) => {
          log.warn('[AfplayPlayer] afplay failed:', err)
          resolve()
        })
        child.on('exit', () => {
          if (this.child === child) this.child = null
          resolve()
        })
        this.child = child
      } catch (err) {
        log.warn('[AfplayPlayer] could not spawn afplay:', err)
        resolve()
      }
    })
  }

  stop(): void {
    this.child?.kill()
    this.child = null
  }
}
