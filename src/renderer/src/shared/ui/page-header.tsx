/** The 44px page header: the page title. Blank space is a window drag region. */
export function PageHeader({ title }: { title: string }): React.JSX.Element {
  return (
    <header
      className="flex h-11 shrink-0 items-center px-4"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <h1 className="text-[13px] font-semibold text-foreground">{title}</h1>
    </header>
  )
}
