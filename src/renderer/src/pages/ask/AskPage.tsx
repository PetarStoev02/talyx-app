import { useEffect, useState } from 'react'
import {
  CalendarDays,
  CalendarPlus,
  FolderGit2,
  FolderDown,
  History,
  ListTodo,
  Mail,
  BellOff,
  BellRing,
  SquarePen,
  Sunrise,
  TerminalSquare
} from 'lucide-react'
import { agentApi } from '@shared/api/agent'
import { Button } from '@shared/ui/button'
import { cn } from '@shared/lib/utils'
import { PageHeader } from '@shared/ui/page-header'
import type { TranslationKey } from '@shared/lib/i18n'
import { useLanguage } from '@app/providers/useLanguage'
import { useAgent } from '@features/assistant/useAgent'
import { ApprovalCard } from '@features/assistant/ApprovalCard'
import { Transcript } from '@features/assistant/Transcript'
import { InstructionInput } from '@features/assistant/InstructionInput'
import { AiSphere } from '@features/assistant/AiSphere'
import { orbStateFor } from '@features/assistant/orbState'
import { ConversationsPanel } from '@features/assistant/ConversationsPanel'
import { useVoiceModeSync } from '@features/assistant/voice/useVoiceMode'
import { VoiceModeSwitch } from '@features/assistant/voice/VoiceModeSwitch'
import { useSpeaking } from '@features/assistant/voice/useSpeaking'

type Suggestion = { icon: typeof FolderGit2; key: TranslationKey }

const EVERYDAY: Suggestion[] = [
  { icon: CalendarDays, key: 'assistant.suggest.calendar' },
  { icon: FolderDown, key: 'assistant.suggest.downloads' },
  { icon: CalendarPlus, key: 'assistant.suggest.event' },
  { icon: BellRing, key: 'assistant.suggest.reminder' },
  { icon: Sunrise, key: 'assistant.suggest.recap' },
  { icon: ListTodo, key: 'assistant.suggest.triage' },
  { icon: BellOff, key: 'assistant.suggest.focus' },
  { icon: Mail, key: 'assistant.suggest.mail' },
  { icon: History, key: 'assistant.suggest.recall' }
]

/** Only people with a projects folder ever see these. */
const DEVELOPER: Suggestion[] = [
  { icon: FolderGit2, key: 'assistant.suggest.repos' },
  { icon: TerminalSquare, key: 'assistant.suggest.tests' }
]

export function AskPage(): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const { phase, transcript, approval, status, run, approve, abort, reset } = useAgent()

  const voiceMode = useVoiceModeSync()
  const speaking = useSpeaking((s) => s.speaking)
  const subscribeSpeaking = useSpeaking((s) => s.subscribe)

  useEffect(() => subscribeSpeaking(), [subscribeSpeaking])

  const [hasProjects, setHasProjects] = useState(false)
  useEffect(() => {
    agentApi
      .status()
      .then((s) => setHasProjects(s.hasProjects))
      .catch(() => setHasProjects(false))
  }, [])
  const suggestions = hasProjects ? [...EVERYDAY, ...DEVELOPER] : EVERYDAY

  const [showConversations, setShowConversations] = useState(false)
  const empty = transcript.length === 0

  return (
    <div className="relative flex h-full flex-col">
      <PageHeader
        title={t('nav.ask')}
        actions={
          <div className="flex items-center gap-2">
            <VoiceModeSwitch />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConversations(true)}
              disabled={phase === 'working'}
              aria-label={t('conversations.open')}
            >
              <History className="size-3.5" />
            </Button>
            {!empty && (
              <Button variant="outline" size="sm" onClick={reset} disabled={phase === 'working'}>
                <SquarePen className="mr-1.5 size-3.5" />
                {t('assistant.newConversation')}
              </Button>
            )}
          </div>
        }
      />

      <div className="min-h-0 flex-1 overflow-auto px-6">
        <div className="mx-auto flex h-full w-full max-w-3xl flex-col">
          {voiceMode ? (
            <div className="flex flex-1 flex-col items-center justify-center py-6">
              <AiSphere size={200} state={orbStateFor(status, speaking)} />
              {!empty && (
                <div className="mt-10 w-full">
                  <Transcript entries={transcript} status={status} voiceMode speaking={speaking} />
                </div>
              )}
            </div>
          ) : empty ? (
            <div className="flex flex-col items-center pt-14 text-center">
              <AiSphere size={96} state={orbStateFor(status, speaking)} />
              <h1 className="mt-8 text-[22px] font-semibold tracking-tight text-foreground">
                {t('assistant.heroTitle')}
              </h1>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                {t('assistant.heroSubtitle')}
              </p>

              <p className="mt-12 self-start text-xs text-muted-foreground">
                {t('assistant.suggested')}
              </p>
              <div
                data-tour="ask-chips"
                className={cn(
                  'mt-3 grid w-full grid-cols-2 gap-3',
                  suggestions.length > 4 ? 'md:grid-cols-3' : 'md:grid-cols-4'
                )}
              >
                {suggestions.map(({ icon: Icon, key }) => (
                  <button
                    key={key}
                    onClick={() => void run(t(key))}
                    className="flex flex-col items-start gap-4 rounded-xl border border-border bg-card/60 p-4 text-left text-[13px] text-foreground transition-colors hover:bg-accent/60"
                  >
                    <Icon className="size-4 text-muted-foreground" />
                    {t(key)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-6">
              <Transcript entries={transcript} status={status} speaking={speaking} />
            </div>
          )}
        </div>
      </div>

      <div className="px-6 pb-4 pt-3">
        <div className="mx-auto w-full max-w-3xl" data-tour="ask-input">
          {phase === 'approval' && approval ? (
            <ApprovalCard request={approval} onDecision={(d) => void approve(d)} />
          ) : (
            <InstructionInput
              busy={phase === 'working'}
              status={status}
              voiceMode={voiceMode}
              onSubmit={(text) => void run(text)}
              onStop={() => void abort()}
              autoFocus
            />
          )}
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            {t('assistant.disclaimer')}
          </p>
        </div>
      </div>

      {showConversations && <ConversationsPanel onClose={() => setShowConversations(false)} />}
    </div>
  )
}
