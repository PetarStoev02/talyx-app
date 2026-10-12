import { parentPort, workerData } from 'worker_threads'
import type { SttInit, SttRequest, SttResponse } from '../voice/SttWorker'

type Transcriber = (
  audio: Float32Array,
  options: { language: string; task: 'transcribe'; chunk_length_s: number }
) => Promise<{ text: string }>

let transcriber: Transcriber | null = null
// Memoize the in-flight load: a 'transcribe' that arrives before a prior load()
// settles must reuse it, or the model loads twice (doubled RAM/compute).
let loading: Promise<Transcriber> | null = null
const init = workerData as SttInit

function send(response: SttResponse): void {
  parentPort?.postMessage(response)
}

/** Loaded once per worker; the host keeps the worker warm between utterances. */
async function load(): Promise<Transcriber> {
  if (transcriber) return transcriber
  if (loading) return loading

  loading = (async () => {
    const { pipeline, env } = await import('@huggingface/transformers')
    // Nothing about the microphone may reach the network: no remote models, ever.
    env.allowRemoteModels = false
    env.localModelPath = init.modelsDir

    const model = (await pipeline('automatic-speech-recognition', init.modelId, {
      dtype: 'q8'
    })) as unknown as Transcriber
    transcriber = model
    return model
  })()

  try {
    return await loading
  } finally {
    // Clear regardless of outcome: a failed load must be retryable on the
    // next call, and a successful one is already cached in `transcriber`.
    loading = null
  }
}

parentPort?.on('message', (message: SttRequest) => {
  load()
    .then((run) =>
      run(message.samples, {
        language: message.language,
        task: 'transcribe',
        chunk_length_s: 30
      })
    )
    .then((output) => send({ type: 'result', id: message.id, text: output.text }))
    .catch((err: unknown) => {
      send({
        type: 'error',
        id: message.id,
        key: 'voice_failed',
        message: err instanceof Error ? err.message : 'Transcription failed'
      })
    })
})
