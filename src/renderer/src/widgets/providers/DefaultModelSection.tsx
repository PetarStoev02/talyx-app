import { toast } from 'sonner'
import { useLanguage } from '@app/providers/useLanguage'
import { setDefaultModel } from '@features/providers/providers'
import type { ModelPick, ProvidersBackend } from '@features/providers/providers'
import type { ModelOptionProvider } from '@shared/engine/gateway-events'
import { Card, CardContent } from '@shared/ui/card'
import { ModelField } from '@shared/ui/ModelPicker'
import { failureText } from './feedback'

/** Talyx's own model, which new bots copy; it applies when picked. */
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

  async function pick(next: ModelPick): Promise<void> {
    try {
      await setDefaultModel(backend, next)
      toast.success(t('providers.defaultChanged').replace('{model}', next.model))
    } catch (error) {
      toast.error(failureText(t, error))
    }
    await onChanged()
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
          onSelect={(next) => void pick(next)}
        />
      </CardContent>
    </Card>
  )
}
