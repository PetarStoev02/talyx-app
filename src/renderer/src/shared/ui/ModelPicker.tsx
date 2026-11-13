import { useEffect, useRef, useState } from 'react'
import { DropdownMenu } from 'radix-ui'
import { ChevronDown } from 'lucide-react'
import type { ModelOptionProvider } from '@shared/engine/gateway-events'
import { Loading, Skeleton } from '@shared/ui/skeleton'
import { CheckItem, menuContentClass, menuLabelClass, separatorClass } from '@shared/ui/menu'
import { cn } from '@shared/lib/utils'

export interface ModelPick {
  provider: string
  model: string
}

/** A choice above the models that stands for one of them, such as "Uses default". */
export interface StandInChoice {
  label: string
  selected: boolean
  onSelect: () => void
}

/** The menu's two placeholder lines: while the list loads, and when it did not. */
export interface ModelPickerLabels {
  loading: string
  failed: string
}

/**
 * The engine's models by provider, asked for each time the menu opens (`load` caches them); after a
 * failed load the next open tries again. `children` is the menu's `DropdownMenu.Trigger`.
 */
export function ModelPicker({
  load,
  selected,
  onSelect,
  labels,
  contentClassName,
  returnFocusTo,
  standIn = null,
  children
}: {
  load: () => Promise<ModelOptionProvider[]>
  selected: ModelPick | null
  onSelect: (pick: ModelPick) => void
  labels: ModelPickerLabels
  contentClassName?: string
  standIn?: StandInChoice | null
  // Where focus goes when the menu closes; the trigger when absent.
  returnFocusTo?: React.RefObject<HTMLElement | null>
  children: React.ReactNode
}): React.JSX.Element {
  const [providers, setProviders] = useState<ModelOptionProvider[] | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  function open(isOpen: boolean): void {
    if (!isOpen) return
    setFailure(null)
    load()
      .then(setProviders)
      .catch((error: unknown) => {
        setProviders(null)
        setFailure(error instanceof Error ? error.message : String(error))
      })
  }

  return (
    <DropdownMenu.Root onOpenChange={open}>
      {children}
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={4}
          align="start"
          className={cn(menuContentClass, contentClassName)}
          onCloseAutoFocus={(event) => {
            if (!returnFocusTo) return
            event.preventDefault()
            returnFocusTo.current?.focus()
          }}
        >
          {standIn && (
            <>
              <CheckItem {...standIn} />
              <DropdownMenu.Separator className={separatorClass} />
            </>
          )}
          {failure ? (
            <div role="alert" className="max-w-72 px-2.5 py-1.5">
              <p>{labels.failed}</p>
              <p className="text-sm text-muted-foreground wrap-anywhere">{failure}</p>
            </div>
          ) : (
            !providers && (
              <Loading label={labels.loading} className="space-y-1 p-1">
                <Skeleton className="mx-1.5 my-1 h-3 w-16" />
                {[0, 1, 2, 3].map((line) => (
                  <Skeleton key={line} className="mx-1.5 h-7" />
                ))}
              </Loading>
            )
          )}
          {providers?.map((provider) => (
            <DropdownMenu.Group key={provider.slug}>
              <DropdownMenu.Label className={menuLabelClass}>{provider.name}</DropdownMenu.Label>
              {(provider.models ?? []).map((model) => (
                <CheckItem
                  key={model}
                  label={model}
                  selected={selected?.model === model && isProvider(provider, selected.provider)}
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

/** A provider row also stands for the slugs it lists as aliases, such as a hidden twin. */
function isProvider(provider: ModelOptionProvider, slug: string): boolean {
  return provider.slug === slug || (provider.aliases ?? []).includes(slug)
}

/**
 * A model choice shown as a form field; `labels.empty` names the engine's default. The list starts
 * loading when the field appears, so the menu usually opens on it; `load` keeps what it loaded.
 */
export function ModelField({
  labels,
  value,
  load,
  onSelect,
  standIn = null
}: {
  labels: ModelPickerLabels & { field: string; empty: string }
  value: ModelPick | null
  load: (() => Promise<ModelOptionProvider[]>) | null
  onSelect: (pick: ModelPick) => void
  standIn?: StandInChoice | null
}): React.JSX.Element {
  const shown = standIn?.selected
    ? standIn.label
    : value
      ? `${value.provider} · ${value.model}`
      : labels.empty
  const preloaded = useRef(false)
  useEffect(() => {
    if (!load || preloaded.current) return
    preloaded.current = true
    // A failure here is shown when the menu opens and loads again.
    load().catch(() => undefined)
  }, [load])
  return (
    <ModelPicker
      load={load ?? (() => Promise.resolve([]))}
      // A stand-in that is chosen is the one ticked, not the model it stands for.
      selected={standIn?.selected ? null : value}
      onSelect={onSelect}
      labels={labels}
      standIn={standIn}
      // A field's menu lines up with the field: as wide as the trigger.
      contentClassName="w-(--radix-dropdown-menu-trigger-width)"
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
