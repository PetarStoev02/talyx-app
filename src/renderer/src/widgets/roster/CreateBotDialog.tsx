import { useLanguage } from '@app/providers/useLanguage'
import { CreateBotForm } from '@features/bots/CreateBotForm'
import type { RosterBackend } from '@features/bots/data'
import { useRoster } from '@features/bots/store'
import type { ModelOptionProvider } from '@shared/engine/gateway-events'
import { Button } from '@shared/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle
} from '@shared/ui/dialog'
import { useCreating } from './creating'

// Mounted only while open, so the form starts empty each time and survives a failed create.
export function CreateBotDialog({
  backend,
  models,
  onClose
}: {
  backend: RosterBackend
  models: ((profile: string) => Promise<ModelOptionProvider[]>) | null
  onClose: () => void
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const inFolder = useCreating((state) => state.inFolder)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogTitle>{t('create.title')}</DialogTitle>
        <DialogDescription>{t('create.hint')}</DialogDescription>
        <CreateBotForm
          backend={backend}
          models={models}
          initialFolderId={inFolder}
          onCreated={(profile) => {
            useRoster.getState().select({ kind: 'bot', id: profile })
            onClose()
          }}
          submitLabel={t('create.submit')}
          secondary={
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                {t('roster.cancel')}
              </Button>
            </DialogClose>
          }
        />
      </DialogContent>
    </Dialog>
  )
}
