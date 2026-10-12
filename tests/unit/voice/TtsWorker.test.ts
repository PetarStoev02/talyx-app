import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TtsWorker, type WorkerLike } from '../../../src/main/infrastructure/voice/TtsWorker'

type Listener = (arg: never) => void

class FakeWorker implements WorkerLike {
  sent: { type: string; id: string; text: string; voice: string }[] = []
  terminated = false
  private listeners = new Map<string, Listener[]>()
  postMessage(message: unknown): void {
    this.sent.push(message as FakeWorker['sent'][number])
  }
  on(event: string, listener: Listener): void {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener])
  }
  terminate(): Promise<number> {
    this.terminated = true
    return Promise.resolve(0)
  }
  emit(event: string, arg: unknown): void {
    for (const listener of this.listeners.get(event) ?? []) listener(arg as never)
  }
  reply(index: number, wav = new Uint8Array([1, 2, 3])): void {
    this.emit('message', { type: 'result', id: this.sent[index].id, wav })
  }
}

function build(idleMs = 1000): { tts: TtsWorker; fakes: FakeWorker[] } {
  const fakes: FakeWorker[] = []
  const tts = new TtsWorker({
    modelId: 'onnx-community/Kokoro-82M-v1.0-ONNX',
    modelsDir: '/tmp/models/voice',
    idleMs,
    spawn: () => {
      const fake = new FakeWorker()
      fakes.push(fake)
      return fake
    }
  })
  return { tts, fakes }
}

describe('TtsWorker', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('should spawn nothing until the first sentence', () => {
    expect(build().fakes).toHaveLength(0)
  })

  it('should resolve with the WAV the worker returns', async () => {
    const { tts, fakes } = build()
    const pending = tts.synthesize('Hello.', 'bm_lewis')
    expect(fakes[0].sent[0]).toMatchObject({
      type: 'synthesize',
      text: 'Hello.',
      voice: 'bm_lewis'
    })
    fakes[0].reply(0, new Uint8Array([9]))
    await expect(pending).resolves.toEqual(new Uint8Array([9]))
  })

  it('should queue sentences and send them one at a time, in order', async () => {
    const { tts, fakes } = build()
    const first = tts.synthesize('One.', 'bm_lewis')
    const second = tts.synthesize('Two.', 'bm_lewis')
    expect(fakes[0].sent).toHaveLength(1)
    fakes[0].reply(0)
    await first
    expect(fakes[0].sent).toHaveLength(2)
    expect(fakes[0].sent[1].text).toBe('Two.')
    fakes[0].reply(1)
    await expect(second).resolves.toBeInstanceOf(Uint8Array)
  })

  it('should reject with the message the worker reported', async () => {
    const { tts, fakes } = build()
    const pending = tts.synthesize('Hello.', 'bm_lewis')
    fakes[0].emit('message', { type: 'error', id: fakes[0].sent[0].id, message: 'no voice file' })
    await expect(pending).rejects.toThrow('no voice file')
  })

  it('should reject everything in flight when the worker crashes, then respawn', async () => {
    const { tts, fakes } = build()
    const first = tts.synthesize('One.', 'bm_lewis')
    const second = tts.synthesize('Two.', 'bm_lewis')
    fakes[0].emit('error', new Error('boom'))
    await expect(first).rejects.toThrow()
    await expect(second).rejects.toThrow()

    const third = tts.synthesize('Three.', 'bm_lewis')
    expect(fakes).toHaveLength(2)
    fakes[1].reply(0)
    await expect(third).resolves.toBeInstanceOf(Uint8Array)
  })

  it('should ignore a stale exit from a replaced worker', async () => {
    const { tts, fakes } = build()
    const first = tts.synthesize('One.', 'bm_lewis')
    fakes[0].emit('error', new Error('boom'))
    await expect(first).rejects.toThrow()
    const second = tts.synthesize('Two.', 'bm_lewis')
    fakes[0].emit('exit', 1)
    expect(fakes[1].terminated).toBe(false)
    fakes[1].reply(0)
    await expect(second).resolves.toBeInstanceOf(Uint8Array)
  })

  it('should unload after the idle window and stay warm while sentences keep coming', async () => {
    const { tts, fakes } = build(1000)
    const first = tts.synthesize('One.', 'bm_lewis')
    fakes[0].reply(0)
    await first
    vi.advanceTimersByTime(900)
    const second = tts.synthesize('Two.', 'bm_lewis')
    fakes[0].reply(1)
    await second
    expect(fakes).toHaveLength(1)
    vi.advanceTimersByTime(1000)
    expect(fakes[0].terminated).toBe(true)
  })

  it('should reject in-flight work on dispose', async () => {
    const { tts } = build()
    const pending = tts.synthesize('One.', 'bm_lewis')
    tts.dispose()
    await expect(pending).rejects.toThrow()
  })
})
