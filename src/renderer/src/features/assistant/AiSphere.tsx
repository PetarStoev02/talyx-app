import { ThinkingOrb, type OrbState } from 'thinking-orbs'
import { cn } from '@shared/lib/utils'

/**
 * The orb's dot cloud is inscribed in its own square canvas; drawn past the
 * edge it fills the face and the circular clip takes the corners.
 */
const FILL = 1.14
/** thinking-orbs ships exactly two tuned canvases; the large one is scaled to fit. */
const ORB_CANVAS = 64

/** Monochrome skin: a graphite body, a rim that turns the disc into a ball,
 *  a slow white sheen, and one fixed highlight so it keeps reading as lit. */
const BODY =
  'absolute inset-0 overflow-hidden rounded-full bg-linear-to-br from-neutral-500 via-neutral-800 to-black ring-1 ring-white/20 ring-inset'
const RIM =
  'absolute inset-0 rounded-full bg-radial-[circle_closest-side] from-transparent from-72% via-black/40 via-88% to-black/85'
const HIGHLIGHT =
  'absolute inset-0 rounded-full bg-radial-[at_30%_25%] from-white/55 via-white/8 to-transparent'
const SHEEN =
  'absolute inset-0 rounded-full bg-radial-[at_30%_80%] from-white/30 via-transparent to-transparent mix-blend-screen'
const ORB_LAYER =
  'absolute inset-0 flex items-center justify-center overflow-hidden rounded-full opacity-60 mix-blend-screen'

interface Props {
  /** Rendered diameter in CSS px. */
  size?: number
  /** What the brain is doing; idle pulses as "connecting". */
  state?: OrbState
  className?: string
}

/**
 * The assistant as a sphere. Everything above the body is screened, so each
 * layer only adds light and the stack reads as one live surface.
 */
export function AiSphere({ size = 96, state = 'connecting', className }: Props): React.JSX.Element {
  return (
    <span
      className={cn('relative inline-flex shrink-0', className)}
      style={{ width: size, height: size }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-6 rounded-full bg-white/10 blur-2xl"
      />
      <span aria-hidden="true" className={cn(BODY, 'shadow-lg')}>
        <span className={ORB_LAYER}>
          <ThinkingOrb
            state={state}
            size={ORB_CANVAS}
            theme="dark"
            speed={0.6}
            style={{ transform: `scale(${(size * FILL) / ORB_CANVAS})` }}
          />
        </span>
        <span className={cn(SHEEN, 'animate-sphere-sheen motion-reduce:animate-none')} />
        <span className={RIM} />
        <span className={HIGHLIGHT} />
      </span>
    </span>
  )
}
