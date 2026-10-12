import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Button } from '@shared/ui/button'
import { Stepper } from '@shared/ui/stepper'
import { useLanguage } from '@app/providers/useLanguage'
import { useTour } from '@app/providers/useTour'
import { TOUR_STEPS, type TourStep } from './steps'
import { highlightFor, placeCard, type Rect } from './geometry'

/** Frames to wait for a target to mount before giving up and centering the card. */
const TARGET_RETRY_FRAMES = 10

function measure(target: string | null): Rect | null {
  if (target === null) return null
  const el = document.querySelector(`[data-tour="${target}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

function rectsEqual(a: Rect | null, b: Rect | null): boolean {
  if (a === null || b === null) return a === b
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height
}

/**
 * Coach marks over the real UI. One card at a time, pinned next to the element
 * carrying the stop's `data-tour` value; a stop whose target is missing or null
 * shows the same card centered so the tour can never get stuck.
 */
export function TourOverlay(): React.JSX.Element | null {
  const stepIndex = useTour((s) => s.stepIndex)
  const next = useTour((s) => s.next)
  const back = useTour((s) => s.back)
  const finish = useTour((s) => s.finish)
  const t = useLanguage((s) => s.t)

  const [target, setTarget] = useState<Rect | null>(null)
  // The step a measurement has completed for; `resolved` below is derived from
  // this instead of a separate flag so the reset-on-step-change needs no direct
  // setState call in the effect body (only the async look() callback sets it).
  const [resolvedStep, setResolvedStep] = useState<TourStep | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [cardSize, setCardSize] = useState({ width: 320, height: 160 })

  const step = stepIndex === null ? null : TOUR_STEPS[stepIndex]
  const resolved = resolvedStep === step
  // While the new stop is still resolving its target, keep showing the
  // previous stop's card/highlight instead of blinking out for a frame. Once
  // the tour itself ends (step is null), hide immediately either way.
  const displayStep = step === null ? null : resolved ? step : resolvedStep

  // Find the target after the view it lives on has had a chance to mount, then
  // keep tracking it every frame for as long as the stop is shown: a target that
  // moves (layout shift, resize) follows, and a target that unmounts (e.g. the
  // sidebar collapsing) drops to null and the card recenters instead of freezing
  // at stale coordinates.
  useEffect(() => {
    if (!step) return
    step.before?.()
    let frames = 0
    let handle = 0
    let lastRect: Rect | null = null
    let hasResolved = false
    const tick = (): void => {
      const rect = measure(step.target)
      if (!hasResolved) {
        if (rect || step.target === null || frames >= TARGET_RETRY_FRAMES) {
          hasResolved = true
          lastRect = rect
          setTarget(rect)
          setResolvedStep(step)
        } else {
          frames += 1
        }
      } else if (!rectsEqual(rect, lastRect)) {
        lastRect = rect
        setTarget(rect)
      }
      handle = requestAnimationFrame(tick)
    }
    handle = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(handle)
  }, [step])

  useLayoutEffect(() => {
    const el = cardRef.current
    if (el) setCardSize({ width: el.offsetWidth, height: el.offsetHeight })
  }, [resolved, stepIndex])

  // Escape closes the tour and must not reach the app's own Escape shortcut.
  useEffect(() => {
    if (!step) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      e.preventDefault()
      finish()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [step, finish])

  if (!displayStep) return null

  const viewport = { width: window.innerWidth, height: window.innerHeight }
  const box = target ? highlightFor(target) : null
  const cardPos = target ? placeCard(target, cardSize, viewport) : null
  const displayIndex = TOUR_STEPS.indexOf(displayStep)
  const last = displayIndex === TOUR_STEPS.length - 1

  return (
    <div
      className="fixed inset-0 z-40"
      role="dialog"
      aria-modal="true"
      aria-label={t(displayStep.titleKey)}
    >
      {box ? (
        <div
          className="pointer-events-none absolute rounded-lg ring-1 ring-foreground/20 transition-all duration-200"
          style={{
            top: box.top,
            left: box.left,
            width: box.width,
            height: box.height,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)'
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/45" />
      )}

      <div
        ref={cardRef}
        className="absolute w-80 rounded-xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur-xl"
        style={
          cardPos
            ? { top: cardPos.top, left: cardPos.left }
            : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
        }
      >
        <Stepper total={TOUR_STEPS.length} current={displayIndex} />
        <h2 className="mt-4 text-sm font-semibold text-foreground">{t(displayStep.titleKey)}</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
          {t(displayStep.bodyKey)}
        </p>
        <div className="mt-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={finish}>
            {t('tour.skip')}
          </Button>
          <div className="flex gap-2">
            {displayIndex > 0 && (
              <Button key="back" variant="outline" size="sm" onClick={back}>
                {t('tour.back')}
              </Button>
            )}
            {/* Keyed on the step so it remounts (and re-autofocuses) each stop
                instead of being reused as the Back button once one appears. */}
            <Button key={displayStep.id} size="sm" autoFocus onClick={next}>
              {last ? t('tour.done') : t('tour.next')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
