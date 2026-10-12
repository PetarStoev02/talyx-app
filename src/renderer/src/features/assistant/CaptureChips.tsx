import { useLanguage } from '@app/providers/useLanguage'
import type { CaptureDestination } from '@shared/api/agent'
import type { TranslationKey } from '@shared/lib/i18n'
import { cn } from '@shared/lib/utils'

const CHIPS: { id: CaptureDestination; label: TranslationKey }[] = [
  { id: 'note', label: 'capture.chip.note' },
  { id: 'reminder', label: 'capture.chip.reminder' },
  { id: 'calendar', label: 'capture.chip.calendar' },
  { id: 'file', label: 'capture.chip.file' }
]

export function CaptureChips({
  value,
  onChange,
  disabled
}: {
  value: CaptureDestination | null
  onChange: (next: CaptureDestination | null) => void
  disabled?: boolean
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)

  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('capture.chipsLabel')}>
      {CHIPS.map((chip) => {
        const selected = value === chip.id
        return (
          <button
            key={chip.id}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            onClick={() => onChange(selected ? null : chip.id)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              selected
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10',
              disabled && 'opacity-50'
            )}
          >
            {t(chip.label)}
          </button>
        )
      })}
    </div>
  )
}
