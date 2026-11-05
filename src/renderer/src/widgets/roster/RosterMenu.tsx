import { DropdownMenu } from 'radix-ui'
import { Ellipsis } from 'lucide-react'
import { cn } from '@shared/lib/utils'
import { DropdownEntries, menuContentClass } from '@shared/ui/menu'
import type { MenuAction } from '@shared/ui/menu'

export type { MenuAction }

/** A round button that opens `actions`: the title row's `+`. */
export function RosterMenu({
  label,
  actions,
  disabled = false,
  icon = <Ellipsis size={18} />,
  className
}: {
  label: string
  actions: MenuAction[]
  disabled?: boolean
  icon?: React.ReactNode
  // Extra trigger classes, such as the raised `+` in the title row.
  className?: string
}): React.JSX.Element {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        disabled={disabled}
        aria-label={label}
        className={cn(
          'inline-flex size-9 shrink-0 items-center self-center justify-center rounded-full hover:bg-foreground/10',
          className
        )}
      >
        {icon}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content sideOffset={4} align="end" className={menuContentClass}>
          <DropdownEntries actions={actions} />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
