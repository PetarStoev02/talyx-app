import { useRef, useState, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'
import { type AppView, useNavigation } from '@features/modules/store'

// Below this window width the panel starts folded: rail, panel and a usable chat need about 900px.
export const FOLD_BELOW_PX = 900

export interface FoldSeen {
  view: AppView
  narrow: boolean
}

/**
 * The user's fold pick once the page or the window changed (null follows the window: folded while
 * it is narrow). Opening a page shows its panel, unless the window is too narrow to fit it beside
 * the page; crossing the width hands the fold back to the window.
 */
export function foldAfter(seen: FoldSeen, now: FoldSeen, choice: boolean | null): boolean | null {
  if (now.view !== seen.view) return now.narrow ? null : true
  if (now.narrow !== seen.narrow) return null
  return choice
}

function subscribeResize(onResize: () => void): () => void {
  window.addEventListener('resize', onResize)
  return () => window.removeEventListener('resize', onResize)
}

export interface PanelFold {
  open: boolean
  /** True from a fold or unfold until its slide ends, so a resize drag never lags the pointer. */
  sliding: boolean
  fold: (next: boolean) => void
  settle: () => void
  foldRef: React.RefObject<HTMLButtonElement | null>
  unfoldRef: React.RefObject<HTMLButtonElement | null>
}

/** The Layered panel's fold: the user's pick, the window's width and the page that is open. */
export function usePanelFold(): PanelFold {
  const currentView = useNavigation((s) => s.currentView)
  const narrow = useSyncExternalStore(subscribeResize, () => window.innerWidth < FOLD_BELOW_PX)
  const [choice, setChoice] = useState<boolean | null>(null)
  const [seen, setSeen] = useState<FoldSeen>({ view: currentView, narrow })
  const [sliding, setSliding] = useState(false)
  const foldRef = useRef<HTMLButtonElement>(null)
  const unfoldRef = useRef<HTMLButtonElement>(null)
  if (seen.view !== currentView || seen.narrow !== narrow) {
    setSeen({ view: currentView, narrow })
    setChoice(foldAfter(seen, { view: currentView, narrow }, choice))
  }

  // The button that took focus disappears, so focus moves to its counterpart.
  function fold(next: boolean): void {
    flushSync(() => {
      setSliding(true)
      setChoice(next)
    })
    ;(next ? foldRef : unfoldRef).current?.focus()
  }

  return {
    open: choice ?? !narrow,
    sliding,
    fold,
    settle: () => setSliding(false),
    foldRef,
    unfoldRef
  }
}
