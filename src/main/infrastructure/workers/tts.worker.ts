import { parentPort, workerData } from 'worker_threads'
import { readFileSync } from 'fs'
import { join } from 'path'
import { phonemizeForKokoro } from '../voice/phonemizeForKokoro'
import type { TtsInit, TtsRequest, TtsResponse } from '../voice/TtsWorker'

type Transformers = typeof import('@huggingface/transformers')
type Model = Awaited<ReturnType<Transformers['StyleTextToSpeech2Model']['from_pretrained']>>
type Tokenizer = Awaited<ReturnType<Transformers['AutoTokenizer']['from_pretrained']>>

interface Loaded {
  lib: Transformers
  model: Model
  tokenizer: Tokenizer
}

const SAMPLE_RATE = 24000
const STYLE_DIM = 256
const MAX_TOKENS = 509

const init = workerData as TtsInit
let loaded: Loaded | null = null
let loading: Promise<Loaded> | null = null
const voices = new Map<string, Float32Array>()

function send(response: TtsResponse): void {
  parentPort?.postMessage(response)
}

/** Loaded once per worker; memoised so back-to-back sentences never load twice. */
function load(): Promise<Loaded> {
  if (loaded) return Promise.resolve(loaded)
  if (loading) return loading
  loading = (async () => {
    const lib = await import('@huggingface/transformers')
    // Nothing about the reply may reach the network: no remote models, ever.
    lib.env.allowRemoteModels = false
    lib.env.localModelPath = init.modelsDir
    const [model, tokenizer] = await Promise.all([
      lib.StyleTextToSpeech2Model.from_pretrained(init.modelId, { dtype: 'q8' }),
      lib.AutoTokenizer.from_pretrained(init.modelId)
    ])
    loaded = { lib, model, tokenizer }
    return loaded
  })().finally(() => {
    loading = null
  })
  return loading
}

/** One 0.5 MB style-vector file per voice, read once. */
function voiceVector(voice: string): Float32Array {
  const cached = voices.get(voice)
  if (cached) return cached
  const file = join(init.modelsDir, init.modelId, 'voices', `${voice}.bin`)
  const bytes = readFileSync(file)
  const vector = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4)
  voices.set(voice, vector)
  return vector
}

async function synthesize(text: string, voice: string): Promise<Uint8Array> {
  const { lib, model, tokenizer } = await load()
  const phonemes = await phonemizeForKokoro(text, voice)
  const { input_ids } = tokenizer(phonemes, { truncation: true }) as {
    input_ids: { dims: number[] }
  }

  // kokoro-js: the style row is chosen by token count, capped at the model's max length.
  const tokens = Math.min(Math.max(input_ids.dims.at(-1)! - 2, 0), MAX_TOKENS)
  const offset = STYLE_DIM * tokens
  const style = new lib.Tensor('float32', voiceVector(voice).slice(offset, offset + STYLE_DIM), [
    1,
    STYLE_DIM
  ])
  const speed = new lib.Tensor('float32', [1], [1])

  const { waveform } = (await model({ input_ids, style, speed })) as {
    waveform: { data: Float32Array }
  }
  const audio = new lib.RawAudio(waveform.data, SAMPLE_RATE)
  return new Uint8Array(await audio.toBlob().arrayBuffer())
}

parentPort?.on('message', (message: TtsRequest) => {
  synthesize(message.text, message.voice)
    .then((wav) => send({ type: 'result', id: message.id, wav }))
    .catch((err: unknown) => {
      send({
        type: 'error',
        id: message.id,
        message: err instanceof Error ? err.message : 'Synthesis failed'
      })
    })
})
