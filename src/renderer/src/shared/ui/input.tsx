import * as React from 'react'
import { cn } from '@/shared/lib/utils'

// Every field sits under its label's text, hence the top margin.
const fieldClass =
  'mt-2 block w-full rounded-lg bg-secondary px-3 py-2 text-base disabled:opacity-50'

function Input({ className, ...props }: React.ComponentProps<'input'>): React.JSX.Element {
  return <input data-slot="input" className={cn(fieldClass, className)} {...props} />
}

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>): React.JSX.Element {
  return (
    <textarea
      data-slot="textarea"
      className={cn(fieldClass, 'resize-none', className)}
      {...props}
    />
  )
}

function NativeSelect({ className, ...props }: React.ComponentProps<'select'>): React.JSX.Element {
  return <select data-slot="native-select" className={cn(fieldClass, className)} {...props} />
}

export { Input, Textarea, NativeSelect }
