import { useEffect } from 'react'

/**
 * Adds `is-in` to each `[data-reveal]` element the first time it scrolls into
 * view, including elements of lazily loaded pages that mount later.
 */
export function useReveal(): void {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('is-in')
          observer.unobserve(entry.target)
        }
      },
      { rootMargin: '0px 0px -10% 0px' }
    )
    // observe() on an element already observed is a no-op, so rescanning is safe.
    function watchNew() {
      document.querySelectorAll('[data-reveal]:not(.is-in)').forEach((el) => observer.observe(el))
    }
    watchNew()
    const mutations = new MutationObserver(watchNew)
    mutations.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      mutations.disconnect()
    }
  }, [])
}
