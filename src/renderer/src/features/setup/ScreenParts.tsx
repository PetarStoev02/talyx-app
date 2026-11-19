import { LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useFlash } from '@shared/hooks/useFlash'
import { useLanguage } from '@shared/lib/i18n'
import { cn } from '@shared/lib/utils'

// How long a Copy button says "Copied." before it reads Copy again.
const COPIED_MS = 1500
const SPINNER_PX = 16

type HeadingLevel = 1 | 2

/** A screen's heading; it takes focus when the screen appears, so a screen reader reads it. */
export function ScreenTitle({
  level,
  children
}: {
  level: HeadingLevel
  children: React.ReactNode
}): React.JSX.Element {
  const Heading = level === 1 ? 'h1' : 'h2'
  return (
    <Heading
      ref={focusOnMount}
      tabIndex={-1}
      className={cn(
        'font-semibold text-foreground outline-none',
        level === 1 ? 'text-2xl' : 'text-xl'
      )}
    >
      {children}
    </Heading>
  )
}

// Stable, so React calls it once, when the heading mounts.
const focusOnMount = (heading: HTMLHeadingElement | null): void => heading?.focus()

/** A whole screen that only waits: its heading is for screen readers, the spinner for the eye. */
export function Waiting({ label }: { label: string }): React.JSX.Element {
  return (
    <>
      <div className="sr-only">
        <ScreenTitle level={2}>{label}</ScreenTitle>
      </div>
      <p aria-hidden="true" className="flex items-center gap-2 text-base text-foreground">
        <Spinner />
        {label}
      </p>
    </>
  )
}

export function Spinner(): React.JSX.Element {
  return (
    <LoaderCircle
      size={SPINNER_PX}
      className="animate-spin motion-reduce:animate-none"
      aria-hidden="true"
    />
  )
}

/** A small pill that copies `text`; `name` is its accessible name when "Copy" alone is unclear. */
export function CopyButton({
  text,
  label,
  name,
  className
}: {
  text: string
  label: string
  name: string | null
  className?: string
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const [copied, showCopied] = useFlash(COPIED_MS)

  return (
    <button
      type="button"
      aria-label={name ?? undefined}
      className={cn(
        'h-7 shrink-0 rounded-full border border-border px-3 text-sm text-foreground hover:bg-foreground/10',
        className
      )}
      onClick={() =>
        void navigator.clipboard
          .writeText(text)
          .then(showCopied, () => toast.error(t('providers.copyFailed')))
      }
    >
      {copied ? t('providers.copied') : label}
    </button>
  )
}
