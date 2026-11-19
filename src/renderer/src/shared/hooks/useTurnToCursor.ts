import { useEffect, useRef, useState } from 'react'

// It turns at most this many degrees, easing over TURN_MS, and stops within SETTLED degrees.
const MAX_TURN = 8
const TURN_MS = 200
const SETTLED = 0.05

/**
 * A yaw that eases toward a few degrees left or right of the cursor, measured from the returned
 * anchor's centre; still while disabled and under reduced motion. The details hero turns with it.
 */
export function useTurnToCursor(
  enabled: boolean
): [React.RefObject<HTMLSpanElement | null>, number] {
  const anchor = useRef<HTMLSpanElement>(null)
  const [yaw, setYaw] = useState(0)
  useEffect(() => {
    if (!enabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let target = 0
    let current = 0
    let frame = 0
    let last = 0
    const step = (time: number): void => {
      // A frame can be stamped before the pointer event that asked for it.
      current += (target - current) * Math.min(1, Math.max(0, time - last) / TURN_MS)
      last = time
      setYaw(current)
      frame = Math.abs(target - current) > SETTLED ? requestAnimationFrame(step) : 0
    }
    const follow = (event: PointerEvent): void => {
      const box = anchor.current?.getBoundingClientRect()
      if (!box) return
      const offset = (event.clientX - (box.left + box.width / 2)) / (window.innerWidth / 2)
      target = Math.max(-1, Math.min(1, offset)) * MAX_TURN
      if (frame) return
      last = performance.now()
      frame = requestAnimationFrame(step)
    }
    window.addEventListener('pointermove', follow)
    return () => {
      window.removeEventListener('pointermove', follow)
      cancelAnimationFrame(frame)
    }
  }, [enabled])
  return [anchor, yaw]
}
