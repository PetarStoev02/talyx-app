import { useState } from 'react'
import { toast } from 'sonner'
import { useLanguage } from '@app/providers/useLanguage'
import { confirmDefaultModel, setDefaultModel } from '@features/providers/providers'
import type { ModelConfirm, ModelPick, ProvidersBackend } from '@features/providers/providers'
import type { ModelOptionProvider } from '@shared/engine/gateway-events'
import { Button } from '@shared/ui/button'
import { Card, CardContent } from '@shared/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@shared/ui/dialog'
import { ModelField } from '@shared/ui/ModelPicker'
import { failureText } from './feedback'

/** Talyx's own model, which new bots copy; it applies when picked, after a yes for a costly one. */
export function DefaultModelSection({
  backend,
  model,
  models,
  onChanged
}: {
  backend: ProvidersBackend
  /** Null while loading, or when Talyx runs on the engine's default. */
  model: ModelPick | null
  models: ((profile: string) => Promise<ModelOptionProvider[]>) | null
  onChanged: () => Promise<void>
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const [confirm, setConfirm] = useState<ModelConfirm | null>(null)

  async function apply(next: ModelPick, change: () => Promise<ModelConfirm | null>): Promise<void> {
    try {
      const question = await change()
      setConfirm(question)
      if (!question) {
        toast.success(t('providers.defaultChanged').replace('{model}', next.model))
        await onChanged()
      }
    } catch (error) {
      setConfirm(null)
      toast.error(failureText(t, error))
    }
  }

  return (
    <Card>
      <CardContent className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">{t('providers.defaultTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('providers.defaultHint')}</p>
        <ModelField
          labels={{
            field: t('providers.defaultTitle'),
            empty: t('details.modelDefault'),
            loading: t('chat.modelsLoading')
          }}
          value={model}
          load={models && (() => models(backend.home))}
          onSelect={(next) => void apply(next, () => setDefaultModel(backend, next))}
        />
      </CardContent>
      <Dialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent className="border-0 bg-card shadow-none backdrop-blur-none">
          <DialogTitle>{t('details.confirmTitle')}</DialogTitle>
          <DialogDescription>{confirm?.message}</DialogDescription>
          <div className="flex gap-2">
            <Button
              className="rounded-full text-base"
              onClick={() =>
                confirm &&
                void apply(confirm.model, async () => {
                  await confirmDefaultModel(backend, confirm.model)
                  return null
                })
              }
            >
              {t('details.confirmUse')}
            </Button>
            <Button
              variant="ghost"
              className="rounded-full text-base"
              onClick={() => setConfirm(null)}
            >
              {t('details.confirmKeep')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
