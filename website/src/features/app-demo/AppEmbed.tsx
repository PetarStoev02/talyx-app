import { useEffect, useRef, useState } from 'react'
import type { DemoView } from '../../app-demo/DemoApp'

/**
 * A slice of the real app, scaled to fit its container: the renderer's own
 * components on stubbed IPC, one route per view.
 */
export function AppEmbed({
  view,
  width,
  height,
  title
}: {
  view: DemoView
  width: number
  height: number
  title: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const [scale, setScale] = useState(0)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [width])

  useEffect(() => {
    if (frame.current?.contentDocument?.readyState === 'complete') setLoaded(true)
  }, [])

  return (
    <div
      ref={box}
      data-ui
      className="relative isolate overflow-hidden rounded-xl bg-[var(--color-bg)]"
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <iframe
        ref={frame}
        src={`/app-demo.html?view=${view}`}
        title={title}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className={`absolute top-0 left-0 origin-top-left border-0 transition-opacity duration-500 ${
          loaded && scale > 0 ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ width, height, transform: `scale(${scale})` }}
      />
    </div>
  )
}
