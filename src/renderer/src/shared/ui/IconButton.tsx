import { cn } from '@shared/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@shared/ui/tooltip'

/** A round icon button named by its tooltip (and, for screen readers, its label). */
export function IconButton({
  label,
  shortcut,
  className,
  children,
  ...props
}: React.ComponentProps<'button'> & {
  label: string
  shortcut?: string
}): React.JSX.Element {
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <button
          aria-label={label}
          className={cn(
            'inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground disabled:opacity-50 [&_svg]:size-[18px]',
            className
          )}
          {...props}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="flex items-center gap-2">
        {label}
        {shortcut && <kbd className="text-xs opacity-60">{shortcut}</kbd>}
      </TooltipContent>
    </Tooltip>
  )
}
