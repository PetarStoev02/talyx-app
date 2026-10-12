import { DropdownMenu } from 'radix-ui'
import { Check, ChevronDown } from 'lucide-react'
import type { ModelOption } from '@shared/api/agent'

/** Which model answers, chosen from what the selected brain can run. Sits inside the input card. */
export function ModelPicker({
  models,
  value,
  label,
  onChange
}: {
  models: ModelOption[]
  value: string
  label: string
  onChange: (id: string) => void
}): React.JSX.Element {
  const selected = models.find((m) => m.id === value) ?? models[0]
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        aria-label={label}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground"
      >
        {selected.label}
        <ChevronDown className="size-3" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="top"
          align="start"
          sideOffset={8}
          className="z-50 min-w-60 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          <DropdownMenu.RadioGroup value={selected.id} onValueChange={onChange}>
            {models.map((option) => (
              <DropdownMenu.RadioItem
                key={option.id}
                value={option.id}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-2 outline-none data-[highlighted]:bg-accent"
              >
                <span className="flex flex-col">
                  <span className="text-sm text-foreground">{option.label}</span>
                  {option.description && (
                    <span className="text-xs text-muted-foreground">{option.description}</span>
                  )}
                </span>
                <DropdownMenu.ItemIndicator>
                  <Check className="size-4" />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
