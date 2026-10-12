import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SttWorker, type WorkerLike } from '../../../src/main/infrastructure/voice/SttWorker'

type Listener = (arg: never) => void

class FakeWorker implements WorkerLike {
  sent: unknown[] = []
  terminated = false
  private listeners = new Map<string, Listener[]>()

  postMessage(message: unknown): void {
    this.sent.push(message)
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
  /** The id the host generated for the request at `index`. */
  idOf(index: number): string {
    return (
      this.sent.filter((m) => (m as { type: string }).type === 'transcribe')[index] as {
        id: string
      }
    ).id
  }
}

function build(): { worker: SttWorker; fakes: FakeWorker[] } {
  const fakes: FakeWorker[] = []
  const worker = new SttWorker({
    modelId: 'onnx-community/whisper-base',
    modelsDir: '/tmp/models/voice',
    idleMs: 1000,
    spawn: () => {
      const fake = new FakeWorker()
      fakes.push(fake)
      return fake
    }
  })
  return { worker, fakes }
}

const SAMPLES = new Float32Array(16000)

describe('SttWorker', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('should spawn nothing until the first utterance', () => {
    const { fakes } = build()
    expect(fakes).toHaveLength(0)
  })

  it('should resolve with the transcribed text', async () => {
    const { worker, fakes } = build()
    const pending = worker.transcribe(SAMPLES, 'en')
    fakes[0].emit('message', { type: 'result', id: fakes[0].idOf(0), text: ' hello there ' })
    await expect(pending).resolves.toBe('hello there')
  })

  it('should reject with the keyed error the worker reported', async () => {
    const { worker, fakes } = build()
    const pending = worker.transcribe(SAMPLES, 'en')
    fakes[0].emit('message', {
      type: 'error',
      id: fakes[0].idOf(0),
      key: 'voice_model_missing',
      message: 'no model'
    })
    await expect(pending).rejects.toMatchObject({ key: 'voice_model_missing' })
  })

  it('should reject a second utterance while one is in flight', async () => {
    const { worker, fakes } = build()
    const first = worker.transcribe(SAMPLES, 'en')
    await expect(worker.transcribe(SAMPLES, 'en')).rejects.toMatchObject({ key: 'voice_failed' })
    fakes[0].emit('message', { type: 'result', id: fakes[0].idOf(0), text: 'ok' })
    await expect(first).resolves.toBe('ok')
  })

  it('should reject the in-flight request when the worker crashes', async () => {
    const { worker, fakes } = build()
    const pending = worker.transcribe(SAMPLES, 'en')
    fakes[0].emit('error', new Error('boom'))
    await expect(pending).rejects.toMatchObject({ key: 'voice_failed' })
  })

  it('should spawn a fresh worker after a crash', async () => {
    const { worker, fakes } = build()
    const pending = worker.transcribe(SAMPLES, 'en')
    fakes[0].emit('error', new Error('boom'))
    await expect(pending).rejects.toThrow()

    const second = worker.transcribe(SAMPLES, 'en')
    expect(fakes).toHaveLength(2)
    fakes[1].emit('message', { type: 'result', id: fakes[1].idOf(0), text: 'again' })
    await expect(second).resolves.toBe('again')
  })

  it('should ignore a stale exit from a crashed worker once a new one is in flight', async () => {
    const { worker, fakes } = build()
    const first = worker.transcribe(SAMPLES, 'en')
    fakes[0].emit('error', new Error('boom'))
    await expect(first).rejects.toThrow()

    const second = worker.transcribe(SAMPLES, 'en')
    expect(fakes).toHaveLength(2)

    // Node fires 'error' and 'exit' on separate ticks — the crashed worker's
    // late 'exit' must not reject the new request or terminate its worker.
    fakes[0].emit('exit', 1)
    expect(fakes[1].terminated).toBe(false)

    fakes[1].emit('message', { type: 'result', id: fakes[1].idOf(0), text: 'ok' })
    await expect(second).resolves.toBe('ok')
  })

  it('should discard a worker that exits while idle and respawn on the next transcribe', async () => {
    const { worker, fakes } = build()
    const pending = worker.transcribe(SAMPLES, 'en')
    fakes[0].emit('message', { type: 'result', id: fakes[0].idOf(0), text: 'ok' })
    await pending

    // No request in flight — a crash here must still drop the dead handle.
    fakes[0].emit('exit', 1)

    const second = worker.transcribe(SAMPLES, 'en')
    expect(fakes).toHaveLength(2)
    fakes[1].emit('message', { type: 'result', id: fakes[1].idOf(0), text: 'again' })
    await expect(second).resolves.toBe('again')
  })

  it('should reject an in-flight request when disposed', async () => {
    const { worker, fakes } = build()
    const pending = worker.transcribe(SAMPLES, 'en')
    worker.dispose()
    await expect(pending).rejects.toMatchObject({ key: 'voice_failed' })
    expect(fakes[0].terminated).toBe(true)
  })

  it('should terminate the worker after the idle window', async () => {
    const { worker, fakes } = build()
    const pending = worker.transcribe(SAMPLES, 'en')
    fakes[0].emit('message', { type: 'result', id: fakes[0].idOf(0), text: 'ok' })
    await pending

    expect(fakes[0].terminated).toBe(false)
    vi.advanceTimersByTime(1000)
    expect(fakes[0].terminated).toBe(true)
  })

  it('should keep the worker warm while utterances keep arriving', async () => {
    const { worker, fakes } = build()
    for (let i = 0; i < 2; i++) {
      const pending = worker.transcribe(SAMPLES, 'en')
      fakes[0].emit('message', { type: 'result', id: fakes[0].idOf(i), text: 'ok' })
      await pending
      vi.advanceTimersByTime(900)
    }
    expect(fakes).toHaveLength(1)
    expect(fakes[0].terminated).toBe(false)
  })
})
