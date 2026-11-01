import { useState } from 'react'

/** An alternative form the composer can swap to, e.g. "Send as task". */
export interface ComposerExtra {
  label: string
  render: (close: () => void) => React.ReactNode
}

interface ChatComposerProps {
  /** Resolves true when sent; errors are reported by the caller. */
  onSend: (text: string) => Promise<boolean>
  extra: ComposerExtra | null
  /** When set the composer is disabled and shows this hint. */
  blocker: string | null
}

const sendButton =
  'h-[30px] cursor-pointer rounded-md border border-white bg-white px-3 text-[13px] text-black hover:bg-[#e5e5e5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-default disabled:opacity-50'

export function ChatComposer({ onSend, extra, blocker }: ChatComposerProps): React.JSX.Element {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [extraOpen, setExtraOpen] = useState(false)

  async function submit(): Promise<void> {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setSending(true)
    if (await onSend(trimmed)) setText('')
    setSending(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
    e.preventDefault()
    void submit()
  }

  return (
    <div className="border-t border-[#2e2e2e] p-3">
      {blocker && <p className="mb-2 text-xs text-[#949494]">{blocker}</p>}
      {extra && (
        <label className="mb-2 flex w-fit cursor-pointer items-center gap-1.5 text-xs text-[#949494]">
          <input
            type="checkbox"
            checked={extraOpen}
            onChange={(e) => setExtraOpen(e.target.checked)}
            className="accent-white"
          />
          {extra.label}
        </label>
      )}
      {extra && extraOpen ? (
        extra.render(() => setExtraOpen(false))
      ) : (
        <form
          aria-label="Message"
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <textarea
            aria-label="Message"
            placeholder="Message"
            value={text}
            rows={2}
            // readOnly rather than disabled keeps focus for the next message
            readOnly={sending}
            disabled={blocker !== null}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-w-0 flex-1 resize-none rounded-md border border-[#444] bg-black p-2 text-[13px] outline-none focus:border-white read-only:opacity-50"
          />
          <button
            type="submit"
            disabled={blocker !== null || sending || !text.trim()}
            className={sendButton}
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </form>
      )}
    </div>
  )
}
