import * as React from 'react'
import { ChevronDown } from 'lucide-react'
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

// The platform's own select, drawn with the model field's chevron and padding so the two match.
function NativeSelect({ className, ...props }: React.ComponentProps<'select'>): React.JSX.Element {
  return (
    <span className="relative mt-2 block">
      <select
        data-slot="native-select"
        className={cn(fieldClass, 'mt-0 appearance-none pr-9', className)}
        {...props}
      />
      <ChevronDown
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
      />
    </span>
  )
}

export { Input, Textarea, NativeSelect }
