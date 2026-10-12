import { MessageSquare, Mic } from 'lucide-react'
import { cn } from '@shared/lib/utils'
import { useLanguage } from '@app/providers/useLanguage'
import { useVoiceMode } from './useVoiceMode'

/**
 * The one control that decides how Talyx answers: Voice talks, Chat writes.
 * Nothing is lost either way — the transcript keeps both, so switching to Chat
 * shows everything that was only spoken.
 */
export function VoiceModeSwitch({ className }: { className?: string }): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const voiceMode = useVoiceMode((s) => s.voiceMode)
  const setVoiceMode = useVoiceMode((s) => s.setVoiceMode)

  return (
    <div
      role="radiogroup"
      aria-label={t('voice.mode.label')}
      className={cn('inline-flex rounded-lg border border-border bg-card p-0.5', className)}
    >
      <Option
        active={voiceMode}
        icon={<Mic className="size-3.5" />}
        label={t('voice.mode.voice')}
        onSelect={() => setVoiceMode(true)}
      />
      <Option
        active={!voiceMode}
        icon={<MessageSquare className="size-3.5" />}
        label={t('voice.mode.chat')}
        onSelect={() => setVoiceMode(false)}
      />
    </div>
  )
}

function Option({
  active,
  icon,
  label,
  onSelect
}: {
  active: boolean
  icon: React.ReactNode
  label: string
  onSelect: () => void
}): React.JSX.Element {
  return (
    <button
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
        active ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {icon}
      {label}
    </button>
  )
}
