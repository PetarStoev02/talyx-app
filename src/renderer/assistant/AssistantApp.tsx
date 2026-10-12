import { useCallback, useEffect, useRef, useState } from 'react'
import { useLanguage } from '@app/providers/useLanguage'
import { agentApi, brainReady, type AgentStatus, type CaptureDestination } from '@shared/api/agent'
import { useAgent } from '@features/assistant/useAgent'
import { ApprovalCard } from '@features/assistant/ApprovalCard'
import { CaptureChips } from '@features/assistant/CaptureChips'
import { Transcript } from '@features/assistant/Transcript'
import { InstructionInput } from '@features/assistant/InstructionInput'
import { AiSphere } from '@features/assistant/AiSphere'
import { orbStateFor } from '@features/assistant/orbState'
import { useVoiceModeSync } from '@features/assistant/voice/useVoiceMode'
import { VoiceModeSwitch } from '@features/assistant/voice/VoiceModeSwitch'
import { useSpeaking } from '@features/assistant/voice/useSpeaking'
import { Button } from '@shared/ui/button'

const RECENT_ENTRIES = 4

export function AssistantApp(): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const setLanguage = useLanguage((s) => s.setLanguage)
  const { phase, transcript, approval, lastError, status, run, dump, approve, abort, subscribe } =
    useAgent()
  const [readiness, setReadiness] = useState<AgentStatus | null>(null)
  /** When set, submit dumps to that destination; otherwise freeform Ask (`agent:run`). */
  const [chip, setChip] = useState<CaptureDestination | null>(null)
  const voiceMode = useVoiceModeSync()
  const speaking = useSpeaking((s) => s.speaking)
  const subscribeSpeaking = useSpeaking((s) => s.subscribe)
  const busy = phase === 'working' || phase === 'approval'

  const syncSettings = useCallback(() => {
    window.api
      .getSettings()
      .then((raw) => {
        const settings = raw as { theme?: string; appLanguage?: string }
        const dark =
          settings.theme === 'dark' ||
          (settings.theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)
        document.documentElement.classList.toggle('dark', dark)
        setLanguage(settings.appLanguage ?? 'en')
      })
      .catch(() => {})
    agentApi
      .status()
      .then(setReadiness)
      .catch(() => setReadiness(null))
  }, [setLanguage])

  useEffect(() => {
    syncSettings()
    const unsubscribeSpeaking = subscribeSpeaking()
    const unsubscribe = subscribe()
    const unsubscribeFocus = window.api.onAssistantFocus(syncSettings)
    return () => {
      unsubscribe()
      unsubscribeSpeaking()
      unsubscribeFocus()
    }
  }, [subscribe, subscribeSpeaking, syncSettings])

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      // Esc never kills a run: that is ⌘⇧Esc or the Stop button
      if (e.key !== 'Escape' || phase === 'approval') return
      void agentApi.hide()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase])

  const claudeReady = readiness !== null && brainReady(readiness)
  const orbState = orbStateFor(status, speaking)
  const showHistory = transcript.length > 0 || status || (phase === 'error' && lastError)

  if (phase === 'approval' && approval) {
    return (
      <Shell>
        <ApprovalCard request={approval} onDecision={(d) => void approve(d)} />
      </Shell>
    )
  }

  return (
    <Shell>
      {showHistory && (
        <div className="max-h-72 overflow-y-auto border-b border-black/5 px-4 py-3 dark:border-white/10">
          <Transcript
            entries={transcript}
            status={status}
            limit={RECENT_ENTRIES}
            voiceMode={voiceMode}
            speaking={speaking}
          />
          {phase === 'error' && lastError && (
            <p className="mt-1 text-xs text-muted-foreground">{t('assistant.errorHint')}</p>
          )}
        </div>
      )}
      {!claudeReady && readiness && (
        <div className="flex items-center justify-between gap-2 border-b border-black/5 px-4 py-2.5 dark:border-white/10">
          <p className="text-xs text-muted-foreground">
            {t(chip ? 'capture.noteFallbackHint' : 'assistant.setupBody')}
          </p>
          <Button size="sm" variant="ghost" onClick={() => void agentApi.openSettings()}>
            {t('assistant.openSettings')}
          </Button>
        </div>
      )}
      <InstructionInput
        busy={busy}
        status={status}
        voiceMode={voiceMode}
        capture={chip !== null}
        composer
        autoFocus
        leading={<AiSphere size={32} state={orbState} className="shrink-0" />}
        footer={
          <div className="flex items-center justify-between gap-3 border-t border-black/5 bg-black/[0.03] px-4 py-2.5 dark:border-white/10 dark:bg-white/[0.04]">
            <CaptureChips value={chip} onChange={setChip} disabled={busy} />
            <VoiceModeSwitch className="border-transparent bg-transparent" />
          </div>
        }
        onSubmit={(text) => {
          if (chip) void dump(text, chip)
          else void run(text)
        }}
        onStop={() => void abort()}
      />
    </Shell>
  )
}

/**
 * One Claude-style liquid-glass capsule. Height tracks content so the Electron
 * window never shows empty frost above the bar.
 */
function Shell({ children }: { children: React.ReactNode }): React.JSX.Element {
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = root.current
    if (!el) return
    const report = (): void => {
      void agentApi.fitOverlay(el.getBoundingClientRect().height)
    }
    report()
    const ro = new ResizeObserver(report)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={root} className="w-full p-3">
      <div
        className={
          'overflow-hidden rounded-[32px] border border-white/50 bg-white/55 ' +
          'shadow-none backdrop-blur-2xl ' +
          'dark:border-white/15 dark:bg-white/10'
        }
      >
        {children}
      </div>
    </div>
  )
}
