import { useEffect, useRef, useState } from 'react'
import { Maximize, Pause, Play, Volume2, VolumeX } from 'lucide-react'

// iOS Safari has no element fullscreen, only the video's own player.
type FullscreenVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void }

/** The launch film, looping and muted until asked. It waits for a play click when motion is reduced. */
export function HeroFilm() {
  const video = useRef<FullscreenVideo>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)

  // Full screen hides the corner buttons, so the browser's own controls stand in until it ends.
  useEffect(() => {
    const showControls = () => {
      if (video.current) video.current.controls = document.fullscreenElement === video.current
    }
    document.addEventListener('fullscreenchange', showControls)
    return () => document.removeEventListener('fullscreenchange', showControls)
  }, [])

  useEffect(() => {
    const el = video.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // React does not render `muted` on the server, and browsers only autoplay muted video.
    el.muted = true
    void el.play().catch(() => setPlaying(false))
  }, [])

  function togglePlay() {
    const el = video.current
    if (!el) return
    if (el.paused) void el.play()
    else el.pause()
  }

  function toggleSound() {
    const el = video.current
    if (!el) return
    el.muted = !el.muted
    if (el.paused) void el.play()
  }

  function fullscreen() {
    const el = video.current
    if (!el) return
    if (el.requestFullscreen) void el.requestFullscreen()
    else el.webkitEnterFullscreen?.()
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
        onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
      />
      <div className="absolute right-3 bottom-3 flex gap-2 sm:right-5 sm:bottom-5">
        <FilmButton label={playing ? 'Pause the film' : 'Play the film'} onClick={togglePlay}>
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </FilmButton>
        <FilmButton
          label={muted ? 'Turn the music on' : 'Turn the music off'}
          onClick={toggleSound}
        >
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </FilmButton>
        <FilmButton label="Watch full screen" onClick={fullscreen}>
          <Maximize className="size-4" />
        </FilmButton>
      </div>
    </div>
  )
}

function FilmButton({
  label,
  onClick,
  children
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-10 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25"
    >
      {children}
    </button>
  )
}
