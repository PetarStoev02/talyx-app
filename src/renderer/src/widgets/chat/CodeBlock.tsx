import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { useLanguage } from '@app/providers/useLanguage'

const COPIED_MS = 1500

/**
 * A finished reply's code block, with a button in its top corner that copies the code. The button
 * shows on hover of the block and while it has focus, and stays in the tab order; hidden, it lets
 * clicks through, so selecting the code under it does not copy.
 */
export function CodeBlock({ children }: { children?: React.ReactNode }): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const code = useRef<HTMLPreElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), COPIED_MS)
    return () => clearTimeout(timer)
  }, [copied])

  function copy(): void {
    // The block ends in the newline that closed its fence; the copy does not.
    const text = (code.current?.textContent ?? '').replace(/\n$/, '')
    navigator.clipboard.writeText(text).then(
      () => setCopied(true),
      () => toast.error(t('chat.copyFailed'))
    )
  }

  return (
    <div className="chat-code group/code relative">
      <pre ref={code}>{children}</pre>
      <button
        type="button"
        aria-label={t('chat.copyCode')}
        onClick={copy}
        className="pointer-events-none absolute end-2 top-2 inline-flex size-7 items-center justify-center rounded-full bg-background text-muted-foreground opacity-0 transition-opacity group-hover/code:pointer-events-auto group-hover/code:opacity-100 hover:text-foreground focus-visible:pointer-events-auto focus-visible:opacity-100"
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </button>
      <span className="sr-only" role="status">
        {copied && t('chat.codeCopied')}
      </span>
    </div>
  )
}
