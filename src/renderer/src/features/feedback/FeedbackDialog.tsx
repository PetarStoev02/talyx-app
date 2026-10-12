import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@shared/ui/dialog'
import { useLanguage } from '@app/providers/useLanguage'
import { FeedbackSection } from './FeedbackSection'

interface FeedbackDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** The Settings feedback form, reachable from anywhere in the app. */
export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('sidebar.feedback')}</DialogTitle>
        </DialogHeader>
        <FeedbackSection onOpened={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}
