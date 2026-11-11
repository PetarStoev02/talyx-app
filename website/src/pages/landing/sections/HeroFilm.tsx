import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'

/** The launch film, muted and looping. It waits for a play click when motion is reduced. */
export function HeroFilm() {
  const video = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const el = video.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // React does not render `muted` on the server, and browsers only autoplay muted video.
    el.muted = true
    void el.play().catch(() => setPlaying(false))
  }, [])

  function toggle() {
    const el = video.current
    if (!el) return
    if (el.paused) {
      el.muted = true
      void el.play()
    } else el.pause()
  }

  return (
    // Never taller than the screen under the header: the width follows the height at 16:9.
    <div className="relative mx-auto max-w-[calc((100svh-8rem)*16/9)] overflow-hidden rounded-2xl bg-black">
      <video
        ref={video}
        className="block aspect-video w-full"
        src="/hero-film.mp4"
        poster="/hero-film.jpg"
        muted
        loop
        playsInline
        preload="auto"
        aria-label="A short film of Talyx: the roster, Talyx handing work to the right bot, approvals, rooms and routines."
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pause the film' : 'Play the film'}
        className="absolute right-3 bottom-3 grid size-10 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25 sm:right-5 sm:bottom-5"
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
      </button>
    </div>
  )
}
