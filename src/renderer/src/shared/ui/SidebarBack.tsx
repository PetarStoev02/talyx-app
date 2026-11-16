import { ArrowLeft } from 'lucide-react'

/** The first row of a page's own sidebar (Settings, Usage): back to the page it was opened from. */
export function SidebarBack({
  label,
  onClick
}: {
  label: string
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-base font-medium text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground [&_svg]:size-4"
    >
      <ArrowLeft />
      {label}
    </button>
  )
}
