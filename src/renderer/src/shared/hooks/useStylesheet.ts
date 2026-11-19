import { useEffect } from 'react'

/** Adds a stylesheet link for `href` to the page while mounted; null adds none. */
export function useStylesheet(href: string | null): void {
  useEffect(() => {
    if (!href) return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    document.head.append(link)
    return () => link.remove()
  }, [href])
}
