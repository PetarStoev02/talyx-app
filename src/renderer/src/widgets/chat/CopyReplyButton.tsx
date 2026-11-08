import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { useLanguage } from '@app/providers/useLanguage'

const COPIED_MS = 1500

/**
 * Copies a reply's markdown from the bubble's top corner. It shows on hover of the reply and while
 * it has focus, and stays in the tab order; the bubble's own background keeps text from showing
 * through it.
 */
export function CopyReplyButton({ text }: { text: string }): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), COPIED_MS)
    return () => clearTimeout(timer)
  }, [copied])

  function copy(): void {
    navigator.clipboard.writeText(text).then(
      () => setCopied(true),
      () => toast.error(t('chat.copyFailed'))
    )
  }

  return (
    <>
      <button
        type="button"
        aria-label={t('chat.copyReply')}
        onClick={copy}
        className="absolute end-2 top-2 inline-flex size-7 items-center justify-center rounded-full bg-secondary text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100"
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </button>
      <span className="sr-only" role="status">
        {copied && t('chat.replyCopied')}
      </span>
    </>
  )
}
