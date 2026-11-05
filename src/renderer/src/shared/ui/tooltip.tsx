import * as React from 'react'
import { Tooltip as TooltipPrimitive } from 'radix-ui'

import { cn } from '@/shared/lib/utils'

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>): React.JSX.Element {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>): React.JSX.Element {
  // Its own provider, so a tooltip also works in a tree without the app's (the roster fixture).
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  )
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>): React.JSX.Element {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>): React.JSX.Element {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          'z-50 w-fit max-w-xs origin-(--radix-tooltip-content-transform-origin) rounded-2xl bg-foreground px-3 py-1.5 text-xs text-balance wrap-break-word text-background',
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

// How long a pointer rests on a cut-off name before its full text shows.
const OVERFLOW_DELAY_MS = 500

/**
 * The full text of a name cut off inside `children` (the trigger, one element), on hover and on
 * keyboard focus. It opens only while some `.truncate` text in the trigger is actually cut off.
 */
function OverflowTooltip({
  text,
  children
}: {
  text: string
  children: React.ReactElement
}): React.JSX.Element {
  const trigger = React.useRef<HTMLButtonElement>(null)
  const [open, setOpen] = React.useState(false)
  const cutOff = (): boolean =>
    [...(trigger.current?.querySelectorAll<HTMLElement>('.truncate') ?? [])].some(
      (element) => element.scrollWidth > element.clientWidth
    )
  return (
    <Tooltip
      open={open}
      delayDuration={OVERFLOW_DELAY_MS}
      onOpenChange={(next) => setOpen(next && cutOff())}
    >
      <TooltipTrigger asChild ref={trigger}>
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom">{text}</TooltipContent>
    </Tooltip>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, OverflowTooltip }
