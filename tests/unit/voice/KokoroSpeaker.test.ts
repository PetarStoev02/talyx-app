import { describe, it, expect } from 'vitest'
import { KokoroSpeaker } from '../../../src/main/infrastructure/voice/KokoroSpeaker'

function deferred<T>(): {
  promise: Promise<T>
  resolve: (v: T) => void
  reject: (e: Error) => void
} {
  let resolve!: (v: T) => void
  let reject!: (e: Error) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function build(): {
  speaker: KokoroSpeaker
  synthCalls: string[]
  synthResults: ReturnType<typeof deferred<Uint8Array>>[]
  played: string[]
  playing: ReturnType<typeof deferred<void>>[]
  stops: number
  fallback: { spoken: string[]; stops: number }
  written: string[]
  removed: string[]
  failWrite: () => void
  speaking: boolean[]
} {
  const synthCalls: string[] = []
  const synthResults: ReturnType<typeof deferred<Uint8Array>>[] = []
  const played: string[] = []
  const playing: ReturnType<typeof deferred<void>>[] = []
  const fallback = { spoken: [] as string[], stops: 0 }
  const written: string[] = []
  const removed: string[] = []
  const state = { stops: 0 }
  const writeFails = { on: false }
  const speaking: boolean[] = []

  const speaker = new KokoroSpeaker({
    synth: {
      synthesize: (text) => {
        synthCalls.push(text)
        const d = deferred<Uint8Array>()
        synthResults.push(d)
        return d.promise
      }
    },
    player: {
      play: (file) => {
        played.push(file)
        const d = deferred<void>()
        playing.push(d)
        return d.promise
      },
      stop: () => {
        state.stops++
      }
    },
    fallback: {
      speak: (text) => {
        fallback.spoken.push(text)
      },
      stop: () => {
        fallback.stops++
      }
    },
    tempDir: '/tmp/t',
    onSpeaking: (on) => speaking.push(on),
    files: {
      write: (p) => {
        if (writeFails.on) throw new Error('ENOSPC: no space left on device')
        written.push(p)
      },
      remove: (p) => removed.push(p)
    }
  })
  return {
    speaking,
    failWrite: () => {
      writeFails.on = true
    },
    speaker,
    synthCalls,
    synthResults,
    played,
    playing,
    get stops() {
      return state.stops
    },
    fallback,
    written,
    removed
  }
}

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

describe('KokoroSpeaker', () => {
  it('should synthesise the next sentence while the current one plays', async () => {
    const b = build()
    b.speaker.speak('Tomorrow is clear. Nothing on your calendar.', 'bm_lewis')
    await flush()
    expect(b.synthCalls).toEqual(['Tomorrow is clear.'])
    b.synthResults[0].resolve(new Uint8Array([1]))
    await flush()
    expect(b.played).toHaveLength(1)
    expect(b.synthCalls).toEqual(['Tomorrow is clear.', 'Nothing on your calendar.'])
    b.synthResults[1].resolve(new Uint8Array([2]))
    await flush()
    // second sentence waits for the first to finish playing
    expect(b.played).toHaveLength(1)
    b.playing[0].resolve()
    await flush()
    expect(b.played).toHaveLength(2)
  })

  it('should write each sentence to its own temp file and remove it after playback', async () => {
    const b = build()
    b.speaker.speak('Tomorrow is clear.', 'bm_lewis')
    await flush()
    b.synthResults[0].resolve(new Uint8Array([1]))
    await flush()
    expect(b.written).toHaveLength(1)
    expect(b.written[0].startsWith('/tmp/t/talyx-tts-')).toBe(true)
    expect(b.removed).toEqual([])
    b.playing[0].resolve()
    await flush()
    expect(b.removed).toEqual(b.written)
  })

  it('should stop the player and discard results that arrive after stop()', async () => {
    const b = build()
    b.speaker.speak('Tomorrow is clear. Nothing on your calendar.', 'bm_lewis')
    await flush()
    b.speaker.stop()
    expect(b.stops).toBe(2)
    b.synthResults[0].resolve(new Uint8Array([1]))
    await flush()
    expect(b.played).toEqual([])
    expect(b.written).toEqual([])
  })

  it('should let a new speak() supersede the one in progress', async () => {
    const b = build()
    b.speaker.speak('First reply here.', 'bm_lewis')
    await flush()
    b.speaker.speak('Second reply here.', 'bm_lewis')
    await flush()
    expect(b.stops).toBe(2)
    b.synthResults[0].resolve(new Uint8Array([1]))
    b.synthResults[1].resolve(new Uint8Array([2]))
    await flush()
    expect(b.played).toHaveLength(1)
    expect(b.written[0]).toContain('talyx-tts-2-')
  })

  it('should fall back to the system voice for the rest of the reply when synthesis fails', async () => {
    const b = build()
    b.speaker.speak('Tomorrow is clear. Nothing on your calendar. Anything else today?', 'bm_lewis')
    await flush()
    b.synthResults[0].resolve(new Uint8Array([1]))
    await flush()
    b.synthResults[1].reject(new Error('no voice file'))
    await flush()
    b.playing[0].resolve()
    await flush()
    expect(b.fallback.spoken).toEqual(['Nothing on your calendar. Anything else today?'])
  })

  it('should fall back to the system voice when the temp write fails', async () => {
    const b = build()
    b.failWrite()
    b.speaker.speak('Tomorrow is clear. Nothing on your calendar.', 'bm_lewis')
    await flush()
    b.synthResults[0].resolve(new Uint8Array([1]))
    await flush()
    expect(b.played).toEqual([])
    expect(b.fallback.spoken).toEqual(['Tomorrow is clear. Nothing on your calendar.'])
  })

  it('should report speaking while a sentence plays and silence when the reply ends', async () => {
    const b = build()
    b.speaker.speak('Tomorrow is clear.', 'bm_lewis')
    await flush()
    expect(b.speaking).toEqual([false]) // speak() stops whatever came before
    b.synthResults[0].resolve(new Uint8Array([1]))
    await flush()
    expect(b.speaking).toEqual([false, true])
    b.playing[0].resolve()
    await flush()
    expect(b.speaking).toEqual([false, true, false])
  })

  it('should say nothing for empty text', async () => {
    const b = build()
    b.speaker.speak('   ', 'bm_lewis')
    await flush()
    expect(b.synthCalls).toEqual([])
  })
})
