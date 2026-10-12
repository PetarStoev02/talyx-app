import * as React from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { GripVertical } from 'lucide-react'

import { cn } from '@/shared/lib/utils'

function ResizablePanelGroup({
  className,
  orientation = 'horizontal',
  ...props
}: React.ComponentProps<typeof Group>): React.JSX.Element {
  return (
    <Group
      data-slot="resizable-panel-group"
      orientation={orientation}
      className={cn('flex h-full w-full', orientation === 'vertical' && 'flex-col', className)}
      {...props}
    />
  )
}

function ResizablePanel({ ...props }: React.ComponentProps<typeof Panel>): React.JSX.Element {
  return <Panel data-slot="resizable-panel" {...props} />
}

function ResizableHandle({
  className,
  withHandle,
  ...props
}: React.ComponentProps<typeof Separator> & { withHandle?: boolean }): React.JSX.Element {
  return (
    <Separator
      data-slot="resizable-handle"
      className={cn(
        'relative flex w-px items-center justify-center bg-border outline-none transition-colors hover:bg-muted-foreground/40 focus-visible:bg-muted-foreground/40 active:bg-muted-foreground/40',
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className="z-10 flex size-4 items-center justify-center rounded-xs border border-border bg-card">
          <GripVertical className="size-2.5 text-muted-foreground" />
        </div>
      )}
    </Separator>
  )
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
