import { useEffect, useRef, useState } from 'react'
import type { DemoView } from '../../app-demo/DemoApp'

/** Messages between the page and its demo frames; app-demo.html speaks the same. */
const THEME_MESSAGE = 'talyx-theme'
const READY_MESSAGE = 'talyx-demo-ready'
/**
 * The dev server refuses module requests from an opaque origin (its CORS guard keeps other sites
 * from reading the source), so the frame is sandboxed in builds only. Vercel serves the built
 * assets with `Access-Control-Allow-Origin: *`; `vite preview` is set to do the same.
 */
const SANDBOX = import.meta.env.DEV ? undefined : 'allow-scripts'
/** Show the frame anyway if its theme answer never comes, so it is never invisible yet clickable. */
const READY_FALLBACK_MS = 1000

/**
 * A slice of the real app, scaled to fit its container: the renderer's own
 * components on stubbed IPC, one route per view.
 *
 * The frame is sandboxed to scripts only, so it runs in an opaque origin and can reach neither
 * this page nor its storage. The page's theme goes in by postMessage; the frame shows once it
 * answers, so it never fades in with the wrong theme.
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
  const [ready, setReady] = useState(false)
  // Browsers start `loading="lazy"` frames far ahead of the viewport; each demo is the whole app.
  const [inView, setInView] = useState(false)
  const fallback = useRef<number | null>(null)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [width])

  useEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      setInView(true)
      observer.disconnect()
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const onMessage = (event: MessageEvent): void => {
      if (event.source === frame.current?.contentWindow && event.data?.type === READY_MESSAGE)
        setReady(true)
    }
    window.addEventListener('message', onMessage)
    // The theme switcher and the system theme both land on data-theme.
    const observer = new MutationObserver(() => sendTheme(frame.current))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    })
    return () => {
      window.removeEventListener('message', onMessage)
      observer.disconnect()
      if (fallback.current !== null) window.clearTimeout(fallback.current)
    }
  }, [])

  return (
    <div
      ref={box}
      data-ui
      className="relative isolate overflow-hidden rounded-xl bg-[var(--color-bg)]"
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      {inView && (
        <iframe
          ref={frame}
          src={`/app-demo.html?view=${view}`}
          title={title}
          loading="lazy"
          sandbox={SANDBOX}
          onLoad={() => {
            sendTheme(frame.current)
            if (fallback.current !== null) window.clearTimeout(fallback.current)
            fallback.current = window.setTimeout(() => setReady(true), READY_FALLBACK_MS)
          }}
          className={`absolute top-0 left-0 origin-top-left border-0 transition-opacity duration-500 ${
            ready && scale > 0 ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ width, height, transform: `scale(${scale})` }}
        />
      )}
    </div>
  )
}

function sendTheme(frame: HTMLIFrameElement | null): void {
  const theme = document.documentElement.getAttribute('data-theme')
  // An opaque origin cannot be named, so '*'; the theme is no secret.
  frame?.contentWindow?.postMessage({ type: THEME_MESSAGE, theme }, '*')
}
