import { useCallback, useEffect, useState } from 'react'
import { ArrowUp, Mic, Square } from 'lucide-react'
import { ThinkingOrb } from 'thinking-orbs'
import { useLanguage } from '@app/providers/useLanguage'
import { settingsApi } from '@shared/api/ipc'
import { agentApi, type ActivityStatus, type ModelOption } from '@shared/api/agent'
import type { TranslationKey } from '@shared/lib/i18n'
import { orbStateFor } from './orbState'
import { ModelPicker } from './ModelPicker'
import { orbThemeOnPrimary } from './orbTheme'
import { useVoice } from './voice/useVoice'
import { useHoldKey } from './voice/useHoldKey'
import { Waveform } from './voice/Waveform'
import type { VoiceHotkey } from './voice/hotkey'
import type { VoiceErrorKey } from '@shared/api/voice'
import { cn } from '@shared/lib/utils'

const VOICE_ERROR_TRANSLATION_KEY: Record<VoiceErrorKey, TranslationKey> = {
  voice_permission_denied: 'voice.error.permissionDenied',
  voice_no_speech: 'voice.error.noSpeech',
  voice_model_missing: 'voice.error.modelMissing',
  voice_failed: 'voice.error.failed'
}

export function InstructionInput({
  busy,
  status,
  onSubmit,
  onStop,
  autoFocus,
  voiceMode = false,
  capture = false,
  /** Claude-style single row: leading icon, input, send. Optional footer slot. */
  composer = false,
  leading = null,
  footer = null
}: {
  busy: boolean
  /** What the brain is doing; shown in place of the placeholder while busy. */
  status: ActivityStatus | null
  onSubmit: (text: string) => void
  onStop: () => void
  autoFocus?: boolean
  /** Voice mode replaces the text field with a hold-to-talk button. */
  voiceMode?: boolean
  /** Overlay Capture uses dump-oriented placeholder copy. */
  capture?: boolean
  composer?: boolean
  leading?: React.ReactNode
  footer?: React.ReactNode
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const [text, setText] = useState('')
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [hotkey, setHotkey] = useState<VoiceHotkey>('Alt+Space')
  const [models, setModels] = useState<ModelOption[]>([])
  const [model, setModel] = useState('')
  const { phase, level, error, transcript, start, stop, cancel, consumeTranscript } = useVoice()

  // Settings are re-read on window focus (not just on mount) so a change made while this host
  // was backgrounded — voiceEnabled off, a different hotkey, another brain — takes effect
  // without an app restart. A plain 'focus' listener covers both the overlay (focused on show)
  // and the Ask page (focused on tab switch), so it is the one mechanism used for both hosts.
  const syncSettings = useCallback((): void => {
    settingsApi
      .get()
      .then((settings) => {
        setVoiceEnabled(settings.voiceEnabled !== false)
        setHotkey((settings.voiceHotkey as VoiceHotkey | undefined) ?? 'Alt+Space')
      })
      .catch(() => setVoiceEnabled(true))
    agentApi
      .status()
      .then((status) => {
        setModels(status.models)
        setModel(status.model)
      })
      .catch(() => setModels([]))
  }, [])

  useEffect(() => {
    syncSettings()
    window.addEventListener('focus', syncSettings)
    return () => window.removeEventListener('focus', syncSettings)
  }, [syncSettings])

  // Applies from the next request on. Re-sync after the save lands, whichever way it went, so
  // a focus-triggered status read that raced the save cannot leave the picker showing a stale id.
  function chooseModel(id: string): void {
    setModel(id)
    settingsApi.set({ assistantModel: id }).then(syncSettings, syncSettings)
  }

  // A live capture must not outlive this component: the overlay hides on blur (keyup then
  // lands elsewhere) and the approval card unmounts this input mid-hold in both hosts.
  useEffect(() => {
    window.addEventListener('blur', cancel)
    return () => {
      window.removeEventListener('blur', cancel)
      cancel()
    }
  }, [cancel])

  const submit = useCallback(
    (value: string): void => {
      const trimmed = value.trim()
      if (busy || trimmed.length === 0) return
      onSubmit(trimmed)
      setText('')
    },
    [busy, onSubmit]
  )

  const beginVoice = useCallback(() => {
    if (busy || text.length > 0 || phase !== 'idle') return
    void start()
  }, [busy, text, phase, start])

  // Release is the commit gesture: what was heard goes straight down the normal path. stop()
  // itself resolves to nothing — the ceiling timer, a key release and a pointer release all
  // deliver the transcript through this one effect on the store's `transcript` field.
  const endVoice = useCallback(() => {
    void stop()
  }, [stop])

  useEffect(() => {
    if (!transcript) return
    // Reacting to an external store (useVoice), not deriving from props/state already
    // available during render — this is the one place the finished transcript arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText(transcript)
    submit(transcript)
    consumeTranscript()
  }, [transcript, submit, consumeTranscript])

  // `enabled` only gates whether the key listeners are attached. busy, text and phase all
  // change mid-capture, so they must stay out of it — beginVoice guards those as START
  // conditions instead, or a capture in progress could lose its release listener.
  useHoldKey({ hotkey, enabled: voiceEnabled, onPress: beginVoice, onRelease: endVoice })

  // Pointer capture keeps the release on this button even if the drag leaves its bounds.
  const handleMicDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId)
      beginVoice()
    },
    [beginVoice]
  )

  const listening = phase === 'listening'
  const showMic = voiceEnabled && !busy && text.length === 0

  // Voice mode: you talk, so there is nothing to type into. The whole row becomes the
  // press-and-hold target, with the waveform showing that Talyx is hearing you.
  if (voiceMode) {
    return (
      <div className="flex flex-col items-center gap-2">
        <button
          onPointerDown={busy ? undefined : handleMicDown}
          onPointerUp={endVoice}
          onClick={busy ? onStop : undefined}
          aria-label={busy ? t('assistant.stop') : t('voice.holdToTalk')}
          className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform active:scale-95"
        >
          {busy || phase === 'transcribing' ? (
            // The 64px canvas carries the per-state choreography; scaled down it stays legible.
            <span className="flex size-7 items-center justify-center overflow-hidden">
              <ThinkingOrb
                state={phase === 'transcribing' ? 'listening' : orbStateFor(status)}
                size={64}
                theme={orbThemeOnPrimary()}
                style={{ transform: 'scale(0.44)' }}
                aria-label={t('assistant.stop')}
              />
            </span>
          ) : (
            <Mic className="size-6" />
          )}
        </button>

        {listening ? (
          <Waveform level={level} />
        ) : (
          <p className="text-xs text-muted-foreground">
            {busy ? t('assistant.stop') : t('voice.holdToTalk')}
          </p>
        )}

        {error && (
          <p className="text-xs text-destructive">{t(VOICE_ERROR_TRANSLATION_KEY[error])}</p>
        )}
      </div>
    )
  }

  const sendButton = (
    <button
      onClick={busy ? onStop : () => submit(text)}
      onPointerDown={showMic ? handleMicDown : undefined}
      onPointerUp={endVoice}
      aria-label={
        busy ? t('assistant.stop') : showMic ? t('voice.holdToTalk') : t('assistant.send')
      }
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full transition-colors',
        busy
          ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
          : 'bg-primary text-primary-foreground'
      )}
    >
      {busy ? (
        <Square className="size-3 fill-current" />
      ) : phase === 'transcribing' ? (
        <ThinkingOrb
          state="listening"
          size={20}
          theme={orbThemeOnPrimary()}
          aria-label={t('voice.listening')}
        />
      ) : showMic ? (
        <Mic className="size-4" />
      ) : (
        <ArrowUp className="size-4" />
      )}
    </button>
  )

  // Claude-style floating composer: one glass shell owned by the parent; this
  // is only the inner row + optional footer strip.
  if (composer) {
    return (
      <div>
        <div className="flex items-center gap-3.5 px-4 py-3.5">
          {leading}
          <div className="relative min-w-0 flex-1">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit(text)}
              placeholder={
                listening
                  ? t('voice.listening')
                  : capture
                    ? t('capture.placeholder')
                    : t('assistant.placeholder')
              }
              autoFocus={autoFocus}
              disabled={busy || phase === 'transcribing'}
              className="w-full border-0 bg-transparent text-[15px] leading-snug text-foreground outline-none ring-0 placeholder:text-muted-foreground/70 focus-visible:outline-none disabled:opacity-60"
            />
            {listening && (
              <div className="absolute inset-y-0 left-0 flex items-center">
                <Waveform level={level} />
              </div>
            )}
          </div>
          {sendButton}
        </div>
        {footer}
        {error && (
          <p className="px-3.5 pb-2 text-xs text-destructive">
            {t(VOICE_ERROR_TRANSLATION_KEY[error])}
          </p>
        )}
      </div>
    )
  }

  return (
    <div>
      <div
        className={
          capture
            ? 'rounded-2xl border border-white/35 bg-white/20 backdrop-blur-xl dark:border-white/12 dark:bg-white/8'
            : 'rounded-2xl border border-border bg-card/80 shadow-sm backdrop-blur'
        }
      >
        <div className="relative">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit(text)}
            placeholder={
              listening
                ? t('voice.listening')
                : capture
                  ? t('capture.placeholder')
                  : t('assistant.placeholder')
            }
            autoFocus={autoFocus}
            disabled={busy || phase === 'transcribing'}
            className="w-full bg-transparent px-4 pb-2 pt-3.5 text-[15px] text-foreground outline-none placeholder:text-muted-foreground/70 focus-visible:outline-none disabled:opacity-60"
          />
          {listening && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2">
              <Waveform level={level} />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5">
          {models.length > 0 ? (
            <ModelPicker
              models={models}
              value={model}
              label={t('settings.assistant.model')}
              onChange={chooseModel}
            />
          ) : (
            <span />
          )}

          {sendButton}
        </div>
      </div>

      {error && (
        <p className="mt-1 text-xs text-destructive">{t(VOICE_ERROR_TRANSLATION_KEY[error])}</p>
      )}
    </div>
  )
}
