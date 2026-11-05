import { DropdownMenu } from 'radix-ui'
import { Ellipsis } from 'lucide-react'

export interface MenuAction {
  label: string
  onSelect: () => void
  disabled?: boolean
}

export function RosterMenu({
  label,
  actions,
  disabled = false,
  compact = false,
  icon = <Ellipsis size={16} />
}: {
  label: string
  actions: MenuAction[]
  disabled?: boolean
  compact?: boolean
  icon?: React.ReactNode
}): React.JSX.Element {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        disabled={disabled}
        aria-label={label}
        className={`${compact ? 'absolute right-0 top-0' : 'self-center'} shrink-0 rounded-full p-2 hover:bg-accent`}
      >
        {icon}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={4}
          className="z-50 max-h-80 min-w-48 overflow-y-auto rounded-xl bg-popover p-2 text-base text-popover-foreground shadow-lg"
        >
          {actions.map((action, index) => (
            <DropdownMenu.Item
              key={index}
              disabled={action.disabled}
              onSelect={action.onSelect}
              className="cursor-default rounded-lg px-3 py-2 outline-none data-[highlighted]:bg-accent data-[disabled]:opacity-40"
            >
              {action.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
