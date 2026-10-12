import { useState } from 'react'
import { Bug, ExternalLink, Lightbulb, MessageSquare, MessageSquarePlus } from 'lucide-react'
import { Button } from '@shared/ui/button'
import { Card, CardContent } from '@shared/ui/card'
import { cn } from '@shared/lib/utils'
import { useLanguage } from '@app/providers/useLanguage'
import type { TranslationKey } from '@shared/lib/i18n'
import { issueUrl, MAX_BODY_CHARS, type FeedbackType } from './githubIssue'

interface TypeConfig {
  icon: typeof Bug
  labelKey: TranslationKey
  placeholderKey: TranslationKey
  labelBg: string
}

const typeConfig: Record<FeedbackType, TypeConfig> = {
  bug: {
    icon: Bug,
    labelKey: 'feedback.typeBug',
    placeholderKey: 'feedback.bugPlaceholder',
    labelBg: 'bg-destructive-subtle text-destructive'
  },
  idea: {
    icon: Lightbulb,
    labelKey: 'feedback.typeIdea',
    placeholderKey: 'feedback.ideaPlaceholder',
    labelBg: 'bg-warning-subtle text-warning'
  },
  other: {
    icon: MessageSquare,
    labelKey: 'feedback.typeOther',
    placeholderKey: 'feedback.otherPlaceholder',
    labelBg: 'bg-info-subtle text-info'
  }
}

interface FeedbackSectionProps {
  /** Called once the issue page has been opened, so a host dialog can close. */
  onOpened?: () => void
}

/** Feedback goes to the public GitHub repo as an issue the user submits in their browser. */
export function FeedbackSection({ onOpened }: FeedbackSectionProps = {}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const [type, setType] = useState<FeedbackType>('bug')
  const [message, setMessage] = useState('')

  function handleOpen(): void {
    if (!message.trim()) return
    // The web-contents guard hands https pages to the default browser.
    window.open(
      issueUrl({
        type,
        message,
        appVersion: __APP_VERSION__,
        systemVersion: window.electron?.systemVersion ?? 'unknown'
      }),
      '_blank'
    )
    setMessage('')
    onOpened?.()
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center gap-2">
          <MessageSquarePlus className="h-4 w-4 text-foreground" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            {t('feedback.title')}
          </h2>
        </div>

        <div className="max-w-md space-y-3">
          <div className="flex gap-1.5">
            {(Object.keys(typeConfig) as FeedbackType[]).map((ft) => {
              const cfg = typeConfig[ft]
              const Icon = cfg.icon
              return (
                <button
                  key={ft}
                  onClick={() => setType(ft)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
                    type === ft
                      ? cfg.labelBg + ' ring-1 ring-current/20'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {t(cfg.labelKey)}
                </button>
              )
            })}
          </div>
          <textarea
            placeholder={t(typeConfig[type].placeholderKey)}
            rows={4}
            maxLength={MAX_BODY_CHARS}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <p className="text-xs text-muted-foreground">{t('feedback.publicNote')}</p>
          <Button onClick={handleOpen} disabled={!message.trim()} size="sm" className="text-xs">
            <ExternalLink className="h-3 w-3 mr-1.5" />
            {t('feedback.openIssue')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
