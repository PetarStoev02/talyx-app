import { Check } from 'lucide-react'
import { useLanguage } from '@app/providers/useLanguage'
import type { SetupStep } from '@features/setup/steps'
import type { TranslationKey } from '@shared/lib/i18n'
import { cn } from '@shared/lib/utils'

const STEPS: Array<{ step: SetupStep; label: TranslationKey }> = [
  { step: 'engine', label: 'setup.stepEngine' },
  { step: 'provider', label: 'setup.stepProvider' },
  { step: 'bot', label: 'setup.stepBot' }
]

/** Engine, Provider, First bot: the steps before `current` are done (or were already). */
export function StepBar({ current }: { current: SetupStep }): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const active = STEPS.findIndex(({ step }) => step === current)
  return (
    <ol aria-label={t('setup.steps')} className="flex items-center gap-1.5 text-sm">
      {STEPS.map(({ step, label }, index) => (
        <li
          key={step}
          aria-current={index === active ? 'step' : undefined}
          className={cn(
            'flex items-center gap-1.5',
            index === active ? 'font-medium text-foreground' : 'text-muted-foreground'
          )}
        >
          {index > 0 && <span aria-hidden="true" className="mr-1.5 h-px w-6 bg-border" />}
          <span
            aria-hidden="true"
            className={cn(
              'grid size-5 place-items-center rounded-full text-xs font-semibold',
              index < active && 'bg-success text-background',
              index === active && 'bg-primary text-primary-foreground',
              index > active && 'bg-secondary'
            )}
          >
            {index < active ? <Check size={12} /> : index + 1}
          </span>
          {t(label)}
          {index < active && <span className="sr-only">{t('setup.stepDone')}</span>}
        </li>
      ))}
    </ol>
  )
}
