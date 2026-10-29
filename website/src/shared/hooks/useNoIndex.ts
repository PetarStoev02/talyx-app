import { useEffect } from 'react'

const NO_INDEX = 'noindex, nofollow'

/**
 * Asks search engines not to index or follow the current page while it is
 * mounted. Rewrites the shell's own robots tag rather than adding a second,
 * conflicting one, and puts it back on the way out.
 */
export function useNoIndex(): void {
  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
    const previous = meta?.content ?? null
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'robots'
      document.head.appendChild(meta)
    }
    meta.content = NO_INDEX
    return () => {
      if (previous === null) meta.remove()
      else meta.content = previous
    }
  }, [])
}
