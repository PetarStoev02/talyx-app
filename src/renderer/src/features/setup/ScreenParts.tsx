import { useEffect, useRef, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useLanguage } from '@app/providers/useLanguage'
import { cn } from '@shared/lib/utils'

// How long a Copy button says "Copied." before it reads Copy again.
const COPIED_MS = 1500

/** A screen's heading; it takes focus when the screen appears, so a screen reader reads it. */
export function ScreenTitle({
  level,
  children
}: {
  level: 1 | 2
  children: React.ReactNode
}): React.JSX.Element {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => ref.current?.focus(), [])
  const Heading = level === 1 ? 'h1' : 'h2'
  return (
    <Heading
      ref={ref}
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

/** A wait with nothing to click: a spinner and what Talyx is doing. */
export function Waiting({ label }: { label: string }): React.JSX.Element {
  return (
    <p role="status" className="flex items-center gap-2 text-base text-foreground">
      <Spinner />
      {label}
    </p>
  )
}

export function Spinner(): React.JSX.Element {
  return (
    <LoaderCircle
      size={16}
      className="animate-spin motion-reduce:animate-none"
      aria-hidden="true"
    />
  )
}

/** A small pill that copies `text`; `name` is its accessible name when "Copy" alone is unclear. */
export function CopyButton({
  text,
  label,
  name
}: {
  text: string
  label: string
  name: string | null
}): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), COPIED_MS)
    return () => clearTimeout(timer)
  }, [copied])

  return (
    <button
      type="button"
      aria-label={name ?? undefined}
      className="h-7 shrink-0 rounded-full border border-border px-3 text-sm text-foreground hover:bg-foreground/10"
      onClick={() =>
        void navigator.clipboard.writeText(text).then(
          () => setCopied(true),
          () => toast.error(t('providers.copyFailed'))
        )
      }
    >
      {copied ? t('providers.copied') : label}
    </button>
  )
}
