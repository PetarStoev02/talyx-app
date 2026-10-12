import { create } from 'zustand'
import { voiceApi, voiceErrorKey } from '@shared/api/voice'
import { encodeWav, toBase64 } from './wav'
import {
  initialVoiceState,
  isSilent,
  voiceReducer,
  MAX_UTTERANCE_MS,
  type VoiceEvent,
  type VoiceState
} from './voiceState'

const TARGET_SAMPLE_RATE = 16000
const LEVEL_INTERVAL_MS = 60

const MIC_CONSTRAINTS: MediaStreamConstraints = {
  audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
}

interface VoiceStore extends VoiceState {
  /** Opens the microphone and starts recording. Safe to call twice. */
  start: () => Promise<void>
  /** Stops recording; the transcript, once ready, lands in `state.transcript`. */
  stop: () => Promise<void>
  cancel: () => void
  /** Clears `state.transcript` once the caller has read it. */
  consumeTranscript: () => void
}

interface Capture {
  stream: MediaStream
  recorder: MediaRecorder
  context: AudioContext
  chunks: Blob[]
  startedAt: number
  levelTimer: number
  maxTimer: number
}

let capture: Capture | null = null

export const useVoice = create<VoiceStore>((set, get) => {
  const dispatch = (event: VoiceEvent): void => set((state) => voiceReducer(state, event))

  async function start(): Promise<void> {
    if (get().phase !== 'idle') return
    dispatch({ type: 'press' })

    const stream = await acquireStream()
    if (!stream) {
      dispatch({ type: 'denied' })
      return
    }

    // The key was released (see stop()'s 'requesting' branch) or cancel() ran while the
    // permission prompt was pending — nothing is holding the key anymore, so open no capture.
    if (get().phase !== 'requesting') {
      for (const track of stream.getTracks()) track.stop()
      return
    }

    try {
      capture = openCapture(stream, dispatch, () => void get().stop())
    } catch {
      // openCapture threw after the mic was already live — stop the tracks or the OS
      // recording indicator stays lit forever with nothing left to reference the stream.
      for (const track of stream.getTracks()) track.stop()
      dispatch({ type: 'denied' })
      return
    }
    dispatch({ type: 'granted' })
  }

  async function stop(): Promise<void> {
    if (get().phase === 'requesting') {
      // start() is still awaiting getUserMedia/the OS prompt — there is no capture yet to
      // close. Land the phase back at idle so start() can tell the key was released.
      dispatch({ type: 'cancel' })
      return
    }

    const active = capture
    if (!active || get().phase !== 'listening') return

    const durationMs = Date.now() - active.startedAt
    const blob = await closeCapture(active)
    capture = null
    dispatch({ type: 'release', durationMs })
    if (get().phase !== 'transcribing') return

    try {
      const samples = await toMonoSamples(blob)
      if (isSilent(samples)) {
        dispatch({ type: 'failed', key: 'voice_no_speech' })
        return
      }
      const wavBase64 = toBase64(encodeWav(samples, TARGET_SAMPLE_RATE))
      const { text } = await voiceApi.transcribe(wavBase64)
      const trimmed = text.trim()
      if (trimmed.length === 0) {
        dispatch({ type: 'failed', key: 'voice_no_speech' })
        return
      }
      dispatch({ type: 'transcript', text: trimmed })
    } catch (err) {
      dispatch({
        type: 'failed',
        key: voiceErrorKey(err instanceof Error ? err.message : '')
      })
    }
  }

  return {
    ...initialVoiceState,
    start,
    stop,
    cancel: () => {
      if (capture) void closeCapture(capture)
      capture = null
      dispatch({ type: 'cancel' })
    },
    consumeTranscript: () => set({ transcript: null })
  }
})

/**
 * `getUserMedia` is the real permission gate in both hosts (Electron and the dev-bridge
 * browser tab). Only fall back to the main process's OS-level ask — meaningless in a browser
 * tab, and otherwise redundant — when the browser itself reports the mic as denied, then
 * retry once.
 */
async function acquireStream(): Promise<MediaStream | null> {
  try {
    return await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS)
  } catch (err) {
    if (!isNotAllowedError(err)) return null
    const { granted } = await voiceApi.permission()
    if (!granted) return null
    try {
      return await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS)
    } catch {
      return null
    }
  }
}

function isNotAllowedError(err: unknown): boolean {
  return err instanceof DOMException && (err.name === 'NotAllowedError' || !err.name)
}

function openCapture(
  stream: MediaStream,
  dispatch: (event: VoiceEvent) => void,
  onCeiling: () => void
): Capture {
  const context = new AudioContext()
  const analyser = context.createAnalyser()
  analyser.fftSize = 512
  context.createMediaStreamSource(stream).connect(analyser)

  const recorder = new MediaRecorder(stream)
  const chunks: Blob[] = []
  recorder.ondataavailable = (event) => chunks.push(event.data)
  recorder.start()

  const buffer = new Uint8Array(analyser.frequencyBinCount)
  const levelTimer = window.setInterval(() => {
    analyser.getByteTimeDomainData(buffer)
    dispatch({ type: 'level', level: rms(buffer) })
  }, LEVEL_INTERVAL_MS)

  return {
    stream,
    recorder,
    context,
    chunks,
    startedAt: Date.now(),
    levelTimer,
    maxTimer: window.setTimeout(onCeiling, MAX_UTTERANCE_MS)
  }
}

function closeCapture(active: Capture): Promise<Blob> {
  window.clearInterval(active.levelTimer)
  window.clearTimeout(active.maxTimer)

  const finish = (resolve: (blob: Blob) => void): void => {
    for (const track of active.stream.getTracks()) track.stop()
    void active.context.close().catch(() => {})
    resolve(new Blob(active.chunks, { type: active.recorder.mimeType }))
  }

  return new Promise<Blob>((resolve) => {
    // Already stopped (e.g. cancel() called twice): resolve now, no onstop will ever fire.
    if (active.recorder.state === 'inactive') {
      finish(resolve)
      return
    }
    active.recorder.onstop = () => finish(resolve)
    active.recorder.stop()
  })
}

/** Chromium resamples on decode: a 16 kHz context yields 16 kHz samples, no resampler needed. */
async function toMonoSamples(blob: Blob): Promise<Float32Array> {
  const context = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE })
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer())
    // Copy out of the AudioBuffer-owned view before context.close() below.
    return decoded.getChannelData(0).slice()
  } finally {
    void context.close().catch(() => {})
  }
}

function rms(samples: Uint8Array): number {
  let sum = 0
  for (const sample of samples) {
    const centred = (sample - 128) / 128
    sum += centred * centred
  }
  return Math.min(1, Math.sqrt(sum / samples.length) * 3)
}
