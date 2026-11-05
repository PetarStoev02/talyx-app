import { useEffect, useRef, useState } from 'react'

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

export function dataUrlOf(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the recording'))
    reader.readAsDataURL(file)
  })
}
