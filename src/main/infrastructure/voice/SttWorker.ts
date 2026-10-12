import { Worker } from 'worker_threads'
import { join } from 'path'
import { randomUUID } from 'crypto'

export type SttErrorKey = 'voice_model_missing' | 'voice_no_speech' | 'voice_failed'

export class SttError extends Error {
  constructor(
    readonly key: SttErrorKey,
    message: string
  ) {
    super(message)
    this.name = 'SttError'
  }
}

export interface SttInit {
  modelId: string
  modelsDir: string
}

export type SttRequest = { type: 'transcribe'; id: string; samples: Float32Array; language: string }

export type SttResponse =
  | { type: 'result'; id: string; text: string }
  | { type: 'error'; id: string; key: SttErrorKey; message: string }

/** Minimal surface of a worker, so tests can hand in a fake instead of spawning one. */
export interface WorkerLike {
  postMessage(message: SttRequest): void
  on(event: 'message' | 'error' | 'exit', listener: (arg: never) => void): void
  terminate(): Promise<number> | void
}

export interface SttWorkerOptions {
  modelId: string
  modelsDir: string
  spawn?: (init: SttInit) => WorkerLike
  /** How long the loaded model stays warm after the last utterance. */
  idleMs?: number
}

const DEFAULT_IDLE_MS = 5 * 60 * 1000

/**
 * One whisper worker, spawned on the first utterance and terminated once it
 * has been idle — a user who never talks to Talyx pays nothing for voice.
 */
export class SttWorker {
  private worker: WorkerLike | null = null
  private pending: {
    id: string
    resolve: (text: string) => void
    reject: (e: Error) => void
  } | null = null
  private idleTimer: NodeJS.Timeout | null = null
  private readonly idleMs: number

  constructor(private readonly options: SttWorkerOptions) {
    this.idleMs = options.idleMs ?? DEFAULT_IDLE_MS
  }

  transcribe(samples: Float32Array, language: string): Promise<string> {
    if (this.pending) {
      return Promise.reject(new SttError('voice_failed', 'A transcription is already running'))
    }
    this.clearIdleTimer()
    const worker = this.ensureWorker()
    const id = randomUUID()

    return new Promise<string>((resolve, reject) => {
      this.pending = { id, resolve, reject }
      worker.postMessage({ type: 'transcribe', id, samples, language })
    }).finally(() => {
      this.pending = null
      this.startIdleTimer()
    })
  }

  dispose(): void {
    this.clearIdleTimer()
    this.pending?.reject(new SttError('voice_failed', 'Voice worker disposed mid-transcription'))
    this.pending = null
    this.terminate()
  }

  private ensureWorker(): WorkerLike {
    if (this.worker) return this.worker

    const init: SttInit = {
      modelId: this.options.modelId,
      modelsDir: this.options.modelsDir
    }
    const worker = this.options.spawn
      ? this.options.spawn(init)
      : (new Worker(join(__dirname, 'stt.worker.js'), {
          workerData: init
        }) as unknown as WorkerLike)

    worker.on('message', ((response: SttResponse) => this.handleMessage(worker, response)) as never)
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
  private handleMessage(worker: WorkerLike, response: SttResponse): void {
    if (worker !== this.worker) return
    if (!this.pending || this.pending.id !== response.id) return

    if (response.type === 'result') {
      this.pending.resolve(response.text.trim())
    } else {
      this.pending.reject(new SttError(response.key, response.message))
    }
  }

  private handleCrash(worker: WorkerLike, message: string): void {
    if (worker !== this.worker) return

    this.pending?.reject(new SttError('voice_failed', message))
    this.worker = null
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
    void this.worker?.terminate()
    this.worker = null
  }
}
