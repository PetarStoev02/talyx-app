import { useState } from 'react'
import { MessageSquarePlus, Settings, Sparkles } from 'lucide-react'
import { cn } from '@shared/lib/utils'
import { Tooltip, TooltipTrigger, TooltipContent } from '@shared/ui/tooltip'
import { useNavigation } from '@app/providers/useNavigation'
import { useLanguage } from '@app/providers/useLanguage'
import { FeedbackDialog } from '@features/feedback/FeedbackDialog'
import type { UpdateStatus } from '@shared/hooks/useAutoUpdater'

export interface UpdaterControls {
  status: UpdateStatus
  version: string | null
  onOpen: () => void
}

export function SidebarFooter({
  collapsed,
  updater
}: {
  collapsed: boolean
  updater: UpdaterControls
}): React.JSX.Element {
  const currentView = useNavigation((s) => s.currentView)
  const navigate = useNavigation((s) => s.navigate)
  const t = useLanguage((s) => s.t)

  const [feedbackOpen, setFeedbackOpen] = useState(false)

  const updateLabel = t('nav.updateVersion').replace('{version}', updater.version ?? '')

  const feedbackDialog = <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />

  if (collapsed) {
    return (
      <>
        {feedbackDialog}
        <div className="flex flex-col items-center gap-1 px-2 pb-2">
          {updater.status === 'available' && (
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <button
                  onClick={updater.onOpen}
                  aria-label={updateLabel}
                  className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                >
                  <Sparkles className="size-[18px]" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{updateLabel}</TooltipContent>
            </Tooltip>
          )}
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <button
                data-tour="feedback"
                onClick={() => setFeedbackOpen(true)}
                aria-label={t('sidebar.feedback')}
                className="flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
              >
                <MessageSquarePlus className="size-[18px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{t('sidebar.feedback')}</TooltipContent>
          </Tooltip>
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <button
                onClick={() => navigate('settings')}
                aria-label={t('sidebar.settings')}
                className={cn(
                  'flex size-9 items-center justify-center rounded-md transition-colors',
                  currentView === 'settings'
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                )}
              >
                <Settings className="size-[18px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{t('sidebar.settings')}</TooltipContent>
          </Tooltip>
        </div>
      </>
    )
  }

  return (
    <>
      {feedbackDialog}
      <div className="flex flex-col gap-0.5 px-2 pb-2">
        {updater.status === 'available' && (
          <button
            onClick={updater.onOpen}
            className="flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          >
            <Sparkles className="size-4 shrink-0" />
            <span className="flex-1 truncate text-left">{updateLabel}</span>
          </button>
        )}

        <button
          data-tour="feedback"
          onClick={() => setFeedbackOpen(true)}
          className="flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
        >
          <MessageSquarePlus className="size-4 shrink-0" />
          <span className="flex-1 truncate text-left">{t('sidebar.feedback')}</span>
        </button>

        <button
          onClick={() => navigate('settings')}
          className={cn(
            'flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors',
            currentView === 'settings'
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
          )}
        >
          <Settings className="size-4 shrink-0" />
          <span className="flex-1 truncate text-left">{t('sidebar.settings')}</span>
        </button>
      </div>
    </>
  )
}
