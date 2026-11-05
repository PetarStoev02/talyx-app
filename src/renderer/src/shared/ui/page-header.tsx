/** The 56px page header, level with the sidebar's title row: the page title. Blank space is a window drag region. */
export function PageHeader({ title }: { title: string }): React.JSX.Element {
  return (
    <header
      className="flex h-14 shrink-0 items-center px-6"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <h1 className="text-xs font-semibold text-foreground">{title}</h1>
    </header>
  )
}
