import { useEffect, useRef, useState } from 'react'
import type { DemoView } from '../../app-demo/DemoApp'

const LIGHTS = ['#ff5f57', '#febc2e', '#28c840']

/**
 * A slice of the real app, scaled to fit its container. Same renderer
 * components and stubbed IPC as the hero — just a different route.
 */
export function AppEmbed({
  view,
  width,
  height,
  title,
  className = '',
  chrome = 'plain'
}: {
  view: DemoView
  width: number
  height: number
  title: string
  className?: string
  chrome?: 'plain' | 'window'
}) {
  const box = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const [scale, setScale] = useState(0)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) =>
      setScale(entry.contentRect.width / width)
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [width])

  useEffect(() => {
    if (frame.current?.contentDocument?.readyState === 'complete') setLoaded(true)
  }, [])

  return (
    <div
      ref={box}
      className={`relative isolate overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] ${className}`}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <iframe
        ref={frame}
        src={`/app-demo.html?view=${view}`}
        title={title}
        onLoad={() => setLoaded(true)}
        className={`absolute top-0 left-0 origin-top-left border-0 transition-opacity duration-500 ${
          loaded && scale > 0 ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ width, height, transform: `scale(${scale})` }}
      />

      {chrome === 'window' ? (
        <div
          className="pointer-events-none absolute flex"
          style={{ top: 15 * scale, left: 18 * scale, gap: 8 * scale }}
        >
          {LIGHTS.map((color) => (
            <span
              key={color}
              className="block rounded-full"
              style={{ width: 12 * scale, height: 12 * scale, backgroundColor: color }}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
