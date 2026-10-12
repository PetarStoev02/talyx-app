import { Worker } from 'worker_threads'
import { join } from 'path'
import { randomUUID } from 'crypto'

export interface TtsInit {
  type: 'init'
  modelId: string
  modelsDir: string
}

export type TtsRequest = { type: 'synthesize'; id: string; text: string; voice: string }

export type TtsResponse =
  | { type: 'result'; id: string; wav: Uint8Array }
  | { type: 'error'; id: string; message: string }

/** Minimal surface of a worker, so tests can hand in a fake instead of spawning one. */
export interface WorkerLike {
  postMessage(message: TtsRequest): void
  on(event: 'message' | 'error' | 'exit', listener: (arg: never) => void): void
  terminate(): Promise<number> | void
}

/** What the speaker needs from a synthesiser: text in, complete WAV out. */
export interface Synth {
  synthesize(text: string, voice: string): Promise<Uint8Array>
}

export interface TtsWorkerOptions {
  modelId: string
  modelsDir: string
  spawn?: (init: TtsInit) => WorkerLike
  /** How long the loaded model stays warm after the last sentence. */
  idleMs?: number
}

interface Job {
  request: TtsRequest
  resolve: (wav: Uint8Array) => void
  reject: (error: Error) => void
}

const DEFAULT_IDLE_MS = 5 * 60 * 1000

/**
 * One Kokoro worker, spawned on the first sentence, fed one sentence at a time
 * (they arrive back to back from a reply), unloaded after five idle minutes.
 */
export class TtsWorker implements Synth {
  private worker: WorkerLike | null = null
  private queue: Job[] = []
  private inFlight: Job | null = null
  private idleTimer: NodeJS.Timeout | null = null
  private readonly idleMs: number

  constructor(private readonly options: TtsWorkerOptions) {
    this.idleMs = options.idleMs ?? DEFAULT_IDLE_MS
  }

  synthesize(text: string, voice: string): Promise<Uint8Array> {
    this.clearIdleTimer()
    return new Promise<Uint8Array>((resolve, reject) => {
      this.queue.push({
        request: { type: 'synthesize', id: randomUUID(), text, voice },
        resolve,
        reject
      })
      this.pump()
    })
  }

  dispose(): void {
    this.clearIdleTimer()
    this.failAll(new Error('TTS worker disposed'))
    this.terminate()
  }

  private pump(): void {
    if (this.inFlight) return
    const next = this.queue.shift()
    if (!next) {
      this.startIdleTimer()
      return
    }
    this.inFlight = next
    this.ensureWorker().postMessage(next.request)
  }

  private ensureWorker(): WorkerLike {
    if (this.worker) return this.worker

    const init: TtsInit = {
      type: 'init',
      modelId: this.options.modelId,
      modelsDir: this.options.modelsDir
    }
    const worker = this.options.spawn
      ? this.options.spawn(init)
      : (new Worker(join(__dirname, 'tts.worker.js'), {
          workerData: init
        }) as unknown as WorkerLike)

    worker.on('message', ((response: TtsResponse) => this.handleMessage(worker, response)) as never)
    worker.on('error', ((error: Error) => this.handleCrash(worker, error.message)) as never)
    worker.on('exit', ((code: number) => {
      this.handleCrash(worker, `Worker exited with code ${code}`)
    }) as never)

    this.worker = worker
    return worker
  }

  // A worker this host has already replaced can still fire late events (Node
  // emits 'error' and 'exit' on separate ticks) — ignore anything that isn't
  // from the current worker instead of acting on a stale one.
  private handleMessage(worker: WorkerLike, response: TtsResponse): void {
    if (worker !== this.worker) return
    const job = this.inFlight
    if (!job || job.request.id !== response.id) return

    this.inFlight = null
    if (response.type === 'result') job.resolve(response.wav)
    else job.reject(new Error(response.message))
    this.pump()
  }

  private handleCrash(worker: WorkerLike, message: string): void {
    if (worker !== this.worker) return
    this.worker = null
    this.failAll(new Error(message))
  }

  private failAll(error: Error): void {
    const jobs = [...(this.inFlight ? [this.inFlight] : []), ...this.queue]
    this.inFlight = null
    this.queue = []
    for (const job of jobs) job.reject(error)
  }

  private startIdleTimer(): void {
    this.clearIdleTimer()
    this.idleTimer = setTimeout(() => this.terminate(), this.idleMs)
    this.idleTimer.unref?.()
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer)
    this.idleTimer = null
  }

  private terminate(): void {
    const worker = this.worker
    this.worker = null
    void worker?.terminate()
  }
}
