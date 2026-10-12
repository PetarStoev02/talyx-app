import * as React from 'react'
import { cn } from '@shared/lib/utils'

const noDragRegion = { WebkitAppRegion: 'no-drag' } as React.CSSProperties

export interface PageHeaderTab {
  id: string
  label: string
  count?: number
}

export interface PageHeaderProps {
  title: string
  tabs?: PageHeaderTab[]
  activeTab?: string
  onTabChange?: (id: string) => void
  actions?: React.ReactNode
}

/**
 * Sticky 44px page header bar: title, optional pill filter tabs, right-aligned
 * actions. Blank space is a window drag region.
 */
export function PageHeader({
  title,
  tabs,
  activeTab,
  onTabChange,
  actions
}: PageHeaderProps): React.JSX.Element {
  return (
    <header
      className="flex h-11 shrink-0 items-center gap-3 border-b border-border/60 px-4"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <h1 className="text-[13px] font-semibold text-foreground">{title}</h1>
      {tabs && (
        <div className="flex items-center gap-1" style={noDragRegion}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange?.(tab.id)}
              className={cn(
                'flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors',
                tab.id === activeTab
                  ? 'border-border bg-accent text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="text-[10px] text-muted-foreground">{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      )}
      <div className="flex-1" />
      {actions && (
        <div className="flex shrink-0 items-center gap-2" style={noDragRegion}>
          {actions}
        </div>
      )}
    </header>
  )
}
