import { useState } from 'react'
import { DropdownMenu } from 'radix-ui'
import { ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import type { ModelOptionProvider } from '@shared/engine/gateway-events'

export interface ModelPick {
  provider: string
  model: string
}

/**
 * The engine's models by provider, loaded the first time the menu opens. `children` is the
 * menu's `DropdownMenu.Trigger`.
 */
export function ModelPicker({
  load,
  selected,
  onSelect,
  loadingLabel,
  children
}: {
  load: () => Promise<ModelOptionProvider[]>
  selected: ModelPick | null
  onSelect: (pick: ModelPick) => void
  loadingLabel: string
  children: React.ReactNode
}): React.JSX.Element {
  const [providers, setProviders] = useState<ModelOptionProvider[] | null>(null)

  function open(isOpen: boolean): void {
    if (!isOpen || providers) return
    load()
      .then(setProviders)
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : String(error))
      )
  }

  return (
    <DropdownMenu.Root onOpenChange={open}>
      {children}
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={4}
          className="z-50 max-h-80 min-w-56 overflow-y-auto rounded-xl bg-popover p-2 text-base text-popover-foreground"
        >
          {!providers && <p className="px-3 py-2 text-muted-foreground">{loadingLabel}</p>}
          {providers?.map((provider) => (
            <DropdownMenu.Group key={provider.slug}>
              <DropdownMenu.Label className="px-3 pt-2 text-sm text-muted-foreground">
                {provider.name}
              </DropdownMenu.Label>
              {(provider.models ?? []).map((model) => (
                <MenuItem
                  key={model}
                  label={model}
                  selected={selected?.model === model && selected.provider === provider.slug}
                  onSelect={() => onSelect({ model, provider: provider.slug })}
                />
              ))}
            </DropdownMenu.Group>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

export function MenuItem({
  label,
  selected,
  onSelect
}: {
  label: string
  selected: boolean
  onSelect: () => void
}): React.JSX.Element {
  return (
    <DropdownMenu.CheckboxItem
      checked={selected}
      onSelect={onSelect}
      className="cursor-default rounded-lg px-3 py-2 outline-none data-[highlighted]:bg-accent data-[state=checked]:font-medium"
    >
      {label}
    </DropdownMenu.CheckboxItem>
  )
}

/** A model choice shown as a form field; `labels.empty` names the engine's default. */
export function ModelField({
  labels,
  value,
  load,
  onSelect
}: {
  labels: { field: string; empty: string; loading: string }
  value: ModelPick | null
  load: (() => Promise<ModelOptionProvider[]>) | null
  onSelect: (pick: ModelPick) => void
}): React.JSX.Element {
  const shown = value ? `${value.provider} · ${value.model}` : labels.empty
  return (
    <ModelPicker
      load={load ?? (() => Promise.resolve([]))}
      selected={value}
      onSelect={onSelect}
      loadingLabel={labels.loading}
    >
      <DropdownMenu.Trigger
        disabled={!load}
        aria-label={`${labels.field}: ${shown}`}
        className="mt-2 flex w-full items-center justify-between rounded-lg bg-secondary px-3 py-2 text-left text-base disabled:opacity-50"
      >
        <span className="truncate">{shown}</span>
        <ChevronDown size={16} className="shrink-0" />
      </DropdownMenu.Trigger>
    </ModelPicker>
  )
}
