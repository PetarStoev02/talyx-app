import { X } from 'lucide-react'
import { useLanguage } from '@shared/lib/i18n'

/** One provider in the list: its name, a badge, its lines, and its actions. */
export function ProviderRow({
  title,
  badge = null,
  lines,
  models = null,
  secret = false,
  children
}: {
  title: string
  badge?: string | null
  lines: string[]
  models?: React.ReactNode
  secret?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  return (
    // A narrow pane puts the actions under the text instead of squeezing the text.
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-secondary p-3">
      <div className="min-w-48 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-medium">
          <span className="min-w-0 wrap-break-word">{title}</span>
          {badge && (
            <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-sm font-normal">
              {badge}
            </span>
          )}
        </p>
        {lines.map((line) => (
          <p
            key={line}
            className={
              secret
                ? 'font-mono text-sm break-all select-text'
                : 'text-sm text-muted-foreground wrap-break-word'
            }
          >
            {line}
          </p>
        ))}
        {models}
      </div>
      <div className="flex shrink-0 gap-3">{children}</div>
    </li>
  )
}

/** The endpoint's saved models, each with its own remove button when it can go. */
export function EndpointModels({
  models,
  onRemove
}: {
  models: string[]
  onRemove: ((model: string) => void) | null
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
      <span>{t('providers.modelsLabel')}</span>
      <ul className="contents">
        {models.map((model) => (
          <li
            key={model}
            className="inline-flex items-center gap-1 rounded-full bg-background py-0.5 pr-1 pl-2 text-foreground"
          >
            <span className="break-all">{model}</span>
            {onRemove ? (
              <button
                aria-label={t('providers.removeModelNamed').replace('{model}', model)}
                title={t('providers.removeModelNamed').replace('{model}', model)}
                onClick={() => onRemove(model)}
                className="rounded-full p-1 transition-colors hover:bg-foreground/10"
              >
                <X size={14} />
              </button>
            ) : (
              <span className="w-1" />
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
