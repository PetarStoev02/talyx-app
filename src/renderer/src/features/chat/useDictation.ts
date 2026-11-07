import { useEffect, useRef, useState } from 'react'
import { problemOf, type Problem } from '@shared/lib/problem'

export type DictationState = 'idle' | 'starting' | 'recording' | 'transcribing'

// The first format this platform records; the engine accepts any of them.
const RECORDING_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']

/**
 * One-shot dictation: the first toggle records, the second stops and sends the recording to be
 * transcribed. The text lands through `onText`; streaming as you talk comes later.
 */
export function useDictation(
  transcribe: (audio: { dataUrl: string; mime: string }) => Promise<string>,
  onText: (text: string) => void,
  onError: (error: unknown) => void
): { state: DictationState; toggle: () => void } {
  const [state, setState] = useState<DictationState>('idle')
  const recorder = useRef<MediaRecorder | null>(null)
  const closed = useRef(false)

  // Leaving the chat mid-recording releases the microphone and drops the recording.
  useEffect(() => {
    closed.current = false
    return () => {
      closed.current = true
      if (recorder.current?.state === 'recording') recorder.current.stop()
    }
  }, [])

  async function start(): Promise<void> {
    setState('starting')
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    if (closed.current) return stream.getTracks().forEach((track) => track.stop())
    const mimeType = RECORDING_TYPES.find((type) => MediaRecorder.isTypeSupported(type))
    const media = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    const chunks: Blob[] = []
    media.ondataavailable = (event) => chunks.push(event.data)
    media.onstop = () => {
      stream.getTracks().forEach((track) => track.stop())
      if (closed.current) return
      const blob = new Blob(chunks, { type: media.mimeType })
      setState('transcribing')
      void dataUrlOf(blob)
        .then((dataUrl) => transcribe({ dataUrl, mime: media.mimeType }))
        .then((text) => text.trim() && onText(text.trim()))
        .catch(onError)
        .finally(() => setState('idle'))
    }
    recorder.current = media
    media.start()
    setState('recording')
  }

  function toggle(): void {
    if (state === 'recording') return recorder.current?.stop()
    if (state === 'idle')
      start().catch((error: unknown) => {
        setState('idle')
        onError(error)
      })
  }

  return { state, toggle }
}

// The engine's fixed opening when the bot has no speech-to-text provider; the rest of its text
// lists environment variables the user cannot set from Talyx.
const NO_PROVIDER = /^No STT provider available/
// An engine error short enough to read in a toast, and naming no environment variable.
const READABLE_MAX = 120
const ENV_VAR = /\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/

/** A failed dictation as the message to show: what went wrong and what the user can do. */
export function dictationProblem(error: unknown): Problem {
  if (error instanceof DOMException && error.name === 'NotAllowedError')
    return { key: 'chat.micDenied', detail: null }
  const { detail } = problemOf(error)
  if (detail && NO_PROVIDER.test(detail)) return { key: 'chat.dictationNoProvider', detail: null }
  const readable =
    detail && detail.length <= READABLE_MAX && !detail.includes('\n') && !ENV_VAR.test(detail)
  return { key: 'chat.dictationFailed', detail: readable ? detail : null }
}

export function dataUrlOf(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the recording'))
    reader.readAsDataURL(file)
  })
}
