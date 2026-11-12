import { Fragment } from 'react'
import { ContextMenu, DropdownMenu } from 'radix-ui'
import { Check, ChevronRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@shared/lib/utils'

/** One entry of a menu: an item, or with `submenu` a "›" row that opens one. */
export interface MenuAction {
  label: string
  icon?: LucideIcon
  onSelect?: () => void
  disabled?: boolean
  /** Red: the action removes something. */
  destructive?: boolean
  /** A line above it, starting a new group. */
  separated?: boolean
  /** A title over the menu's entries, not an entry itself. */
  heading?: boolean
  /** The current choice among its siblings: a check in place of the icon, and nothing to do. */
  current?: boolean
  submenu?: MenuAction[]
}

// Every menu in the app: a raised card, 14px rows with a 16px icon, groups split by a line.
export const menuContentClass =
  'talyx-menu z-50 max-h-80 min-w-48 overflow-y-auto rounded-2xl bg-popover p-1.5 text-sm text-popover-foreground shadow-lg ring-1 ring-border'
export const menuItemClass =
  'flex cursor-default items-center gap-2.5 rounded-lg px-2.5 py-1.5 select-none data-[disabled]:opacity-40 data-[highlighted]:bg-foreground/10 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground'
export const menuLabelClass = 'px-2.5 pt-2 pb-1 text-xs text-muted-foreground'
const separatorClass = '-mx-1.5 my-1.5 h-px bg-border'
const destructiveClass = 'text-destructive-text [&_svg]:text-destructive-text'

// The dropdown and the context menu are built from the same Radix menu parts.
type MenuParts = typeof DropdownMenu

function Entries({
  parts: Menu,
  actions
}: {
  parts: MenuParts
  actions: MenuAction[]
}): React.JSX.Element {
  return (
    <>
      {actions.map((action, index) => {
        const Icon = action.current ? Check : action.icon
        const body = (
          <>
            {Icon ? (
              <Icon aria-hidden="true" />
            ) : (
              <span className="size-4 shrink-0" aria-hidden="true" />
            )}
            <span className="min-w-0 flex-1 truncate">{action.label}</span>
          </>
        )
        const className = cn(menuItemClass, action.destructive && destructiveClass)
        return (
          <Fragment key={index}>
            {action.separated && index > 0 && <Menu.Separator className={separatorClass} />}
            {action.heading ? (
              <Menu.Label className={menuLabelClass}>{action.label}</Menu.Label>
            ) : action.submenu ? (
              <Menu.Sub>
                <Menu.SubTrigger disabled={action.disabled} className={className}>
                  {body}
                  <ChevronRight aria-hidden="true" />
                </Menu.SubTrigger>
                <Menu.Portal>
                  <Menu.SubContent sideOffset={6} className={menuContentClass}>
                    <Entries parts={Menu} actions={action.submenu} />
                  </Menu.SubContent>
                </Menu.Portal>
              </Menu.Sub>
            ) : (
              <Menu.Item
                disabled={action.disabled || action.current}
                onSelect={action.onSelect}
                className={cn(className, action.current && 'data-[disabled]:opacity-100')}
              >
                {body}
              </Menu.Item>
            )}
          </Fragment>
        )
      })}
    </>
  )
}

/** A dropdown's entries; the caller supplies `DropdownMenu.Root`, its trigger and content. */
export function DropdownEntries({ actions }: { actions: MenuAction[] }): React.JSX.Element {
  return <Entries parts={DropdownMenu} actions={actions} />
}

/** Entries built in their own render: menu content renders only while open. */
export function BuiltEntries({
  parts = DropdownMenu,
  build
}: {
  parts?: MenuParts
  build: () => MenuAction[]
}): React.JSX.Element {
  return <Entries parts={parts} actions={build()} />
}

/**
 * `children` (one element) opens `actions` on right-click. From the keyboard, Shift+F10 or the
 * menu key opens it at the row, since macOS sends no context-menu event for those keys. The
 * entries are built when the menu opens, so a long list of rows builds none of them.
 */
export function ContextMenuArea({
  actions,
  disabled = false,
  children
}: {
  actions: () => MenuAction[]
  disabled?: boolean
  children: React.ReactElement
}): React.JSX.Element {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger
        asChild
        disabled={disabled}
        onKeyDown={(event) => {
          if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return
          event.preventDefault()
          const box = event.currentTarget.getBoundingClientRect()
          event.currentTarget.dispatchEvent(
            new MouseEvent('contextmenu', {
              bubbles: true,
              clientX: box.left + box.width / 2,
              clientY: box.bottom
            })
          )
        }}
      >
        {children}
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className={menuContentClass}>
          {/* Same parts under another Root; the types differ only in Root, Trigger and Content. */}
          <BuiltEntries parts={ContextMenu as unknown as MenuParts} build={actions} />
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  )
}

/** A choice in a picker menu (a model, a reasoning level): a check marks the selected one. */
export function CheckItem({
  label,
  selected,
  onSelect
}: {
  label: string
  selected: boolean
  onSelect: () => void
}): React.JSX.Element {
  return (
    <DropdownMenu.CheckboxItem checked={selected} onSelect={onSelect} className={menuItemClass}>
      {selected ? (
        <Check aria-hidden="true" />
      ) : (
        <span className="size-4 shrink-0" aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </DropdownMenu.CheckboxItem>
  )
}
