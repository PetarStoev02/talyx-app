import { useEffect, useLayoutEffect, useRef } from 'react'

const MOVE_MS = 200
const EASE_IN_OUT = 'cubic-bezier(0.65, 0, 0.35, 1)'
const motionOff = window.matchMedia('(prefers-reduced-motion: reduce)')

interface Place {
  x: number
  y: number
  // The keys before and after it in its list: a change means it was reordered, pinned or moved.
  neighbours: string
}

/**
 * After a render that reorders a list inside `container`, each `[data-flip]` element whose
 * neighbours changed glides from where it was to where it is now. Positions are measured in the
 * container's scrolled content, and re-read when a part finishes opening or closing (a folder),
 * so scrolling and folding never count as moves.
 */
export function useFlip(container: React.RefObject<HTMLElement | null>): void {
  const last = useRef(new Map<string, Place>())

  useLayoutEffect(() => {
    const root = container.current
    if (!root) return
    const next = measure(root)
    if (!motionOff.matches)
      for (const [key, place] of next) {
        const was = last.current.get(key)
        if (!was || was.neighbours === place.neighbours) continue
        const dx = was.x - place.x
        const dy = was.y - place.y
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue
        root
          .querySelector<HTMLElement>(`[data-flip="${CSS.escape(key)}"]`)
          ?.animate(
            [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
            { duration: MOVE_MS, easing: EASE_IN_OUT }
          )
      }
    last.current = next
  })

  useEffect(() => {
    const root = container.current
    if (!root) return
    const remeasure = (): void => {
      last.current = measure(root)
    }
    root.addEventListener('transitionend', remeasure)
    return () => root.removeEventListener('transitionend', remeasure)
  }, [container])
}

function measure(root: HTMLElement): Map<string, Place> {
  const base = root.getBoundingClientRect()
  const places = new Map<string, Place>()
  for (const element of root.querySelectorAll<HTMLElement>('[data-flip]')) {
    const siblings = [...(element.parentElement?.children ?? [])].filter(
      (item): item is HTMLElement => item instanceof HTMLElement && !!item.dataset.flip
    )
    const index = siblings.indexOf(element)
    const box = element.getBoundingClientRect()
    places.set(element.dataset.flip!, {
      x: box.left - base.left,
      y: box.top - base.top + root.scrollTop,
      neighbours: `${siblings[index - 1]?.dataset.flip ?? ''}|${siblings[index + 1]?.dataset.flip ?? ''}`
    })
  }
  return places
}
