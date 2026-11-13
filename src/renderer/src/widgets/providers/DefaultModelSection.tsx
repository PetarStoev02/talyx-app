import { useState } from 'react'
import { toast } from 'sonner'
import { useLanguage } from '@app/providers/useLanguage'
import type { RosterBackend } from '@features/bots/data'
import { followDefault } from '@features/bots/details'
import { reportFollowing } from '@features/bots/spread'
import { confirmDefaultModel, setDefaultModel } from '@features/providers/providers'
import type { ModelConfirm, ModelPick, ProvidersBackend } from '@features/providers/providers'
import type { ModelOptionProvider } from '@shared/engine/gateway-events'
import { Button } from '@shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@shared/ui/dialog'
import { ModelField } from '@shared/ui/ModelPicker'
import { failureText } from './feedback'

/**
 * Talyx's own model, which new bots copy and bots on "Uses default" follow; it applies when
 * picked, after a yes for a costly one.
 */
export function DefaultModelSection({
  backend,
  roster,
  model,
  models,
  onChanged
}: {
  backend: ProvidersBackend
  /** Reaches the bots on "Uses default"; null while the engine's socket has not opened, which
   *  keeps the field disabled. */
  roster: RosterBackend | null
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
        if (roster) await reportFollowing(t, followDefault(roster, next))
      }
    } catch (error) {
      setConfirm(null)
      toast.error(failureText(t, error), { duration: Infinity })
    }
  }

  return (
    <section className="space-y-2">
      <h2 className="text-xl font-semibold text-foreground">{t('providers.defaultTitle')}</h2>
      <p className="text-base">{t('providers.defaultHint')}</p>
      <ModelField
        labels={{
          field: t('providers.defaultTitle'),
          empty: t('details.modelDefault'),
          loading: t('chat.modelsLoading'),
          failed: t('chat.modelsFailed')
        }}
        value={model}
        // Waits for the bots, so a change never leaves the ones on Uses default behind unseen.
        load={models && roster && (() => models(backend.home))}
        onSelect={(next) => void apply(next, () => setDefaultModel(backend, next))}
      />

      <Dialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogTitle>{t('details.confirmTitle')}</DialogTitle>
          <DialogDescription>{confirm?.message}</DialogDescription>
          <div className="flex gap-2">
            <Button
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
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              {t('details.confirmKeep')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
