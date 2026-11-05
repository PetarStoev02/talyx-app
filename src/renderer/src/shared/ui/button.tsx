import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/shared/lib/utils'

// One shape, the full pill. Focus shows the app-wide outline from theme.css.
const buttonVariants = cva(
  "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-full px-4 py-2 text-base font-medium whitespace-nowrap transition-all disabled:pointer-events-none disabled:opacity-50 has-[>svg]:px-3 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-white hover:bg-destructive/90',
        ghost: 'hover:bg-accent hover:text-accent-foreground'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
)

function Button({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants>): React.JSX.Element {
  return (
    <button
      data-slot="button"
      data-variant={variant}
      className={cn(buttonVariants({ variant, className }))}
      {...props}
    />
  )
}

export { Button }
