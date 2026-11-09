import { useId } from 'react'
import { cn } from '@shared/lib/utils'
import { BLOCK_SHAPES, blockGeometry, blockTones, frontPoint } from './blockGeometry'
import type { BlockShape, Point } from './blockGeometry'
import { TALYX_CUTS, TALYX_SILHOUETTE } from './talyxMark'

export type BlockState = 'idle' | 'working' | 'waiting' | 'offline'

export interface BlockAvatarProps {
  // `talyx` is the manager: the logo as a block in black and white.
  shape: BlockShape | 'talyx'
  // An index into BLOCK_HUES; Talyx has none.
  hue: number
  size: number
  state?: BlockState
  face?: boolean
  // Blink, the working bob and the ticks turning between states.
  animated?: boolean
  // Degrees about the vertical axis, for the details hero following the cursor.
  yaw?: number
}

// The face is drawn from this size up; a 24px row shows the plain block.
const FACE_MIN_SIZE = 40

// An expression is a set of angles, in degrees from vertical; the ticks turn between them.
const EXPRESSIONS: Record<
  BlockState,
  { eyes: [number, number]; brow: boolean; mouth: { angle: number; length: number } }
> = {
  idle: { eyes: [0, 0], brow: false, mouth: { angle: 0, length: 1 } },
  working: { eyes: [35, 35], brow: false, mouth: { angle: 0, length: 0.57 } },
  waiting: { eyes: [0, -25], brow: true, mouth: { angle: 35, length: 0.6 } },
  offline: { eyes: [90, 90], brow: false, mouth: { angle: 0, length: 0.43 } }
}

// The logo's silhouette as three flat faces in a 226 × 251 box, and the front face's corners
// (bottom left, bottom right, top right, top left) where the face sits.
const TALYX = {
  top: [
    [113, -4.67],
    [225.73, 60.41],
    [113, 125.5],
    [0.27, 60.41]
  ],
  left: [
    [0.27, 60.41],
    [113, 125.5],
    [113, 255.67],
    [0.27, 190.59]
  ],
  right: [
    [113, 125.5],
    [225.73, 60.41],
    [225.73, 190.59],
    [113, 255.67]
  ],
  // The logo's front plate, the largest flat area on the left face.
  front: [
    [24.42, 176.64],
    [113, 227.78],
    [113, 125.5],
    [24.42, 74.36]
  ]
} satisfies Record<string, Point[]>
const TALYX_TONES = { top: '#e9e9ee', left: '#2a2a30', right: '#141418', stripe: '#7a7a84' }
const TALYX_INK = '#ffffff'
const TALYX_BOX = 251
const TALYX_TICK = 22
const TALYX_STROKE = 9

/** A bot's avatar: an isometric block in three flat tones of its hue, with a face of ticks. */
export function BlockAvatar({
  shape,
  hue,
  size,
  state = 'idle',
  face = true,
  animated = false,
  yaw = 0
}: BlockAvatarProps): React.JSX.Element {
  const outline = useId()
  const faced = face && size >= FACE_MIN_SIZE
  // Blinks every 4 to 6 s, so a grid of blocks does not blink in step.
  const seed =
    hue +
    Math.max(
      0,
      BLOCK_SHAPES.findIndex((item) => item === shape)
    )
  const blink = `${4 + (seed % 5) / 2}s`
  const options = faced && { state, animated, blink }
  const drawing =
    shape === 'talyx'
      ? talyxDrawing(options, outline)
      : blockDrawing({ shape, hue, size, yaw, offline: state === 'offline' }, options)
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox={drawing.viewBox}
      aria-hidden="true"
      className={cn('shrink-0', animated && state === 'working' && 'block-bob')}
    >
      {drawing.body}
    </svg>
  )
}

interface FaceOptions {
  state: BlockState
  animated: boolean
  blink: string
}

function blockDrawing(
  block: { shape: BlockShape; hue: number; size: number; yaw: number; offline: boolean },
  face: FaceOptions | false
): { viewBox: string; body: React.JSX.Element } {
  const { faces, frontIndex, scale } = blockGeometry(block.shape, block.size, block.yaw)
  const tones = blockTones(block.hue, block.offline)
  return {
    viewBox: `0 0 ${block.size} ${block.size}`,
    body: (
      <>
        {faces.map((item, index) => (
          <polygon key={index} points={pointList(item.points)} fill={tones[item.tone]} />
        ))}
        {face && (
          <Face
            front={faces[frontIndex].points}
            pen={{ ink: tones.ink, tick: scale * 0.16, width: Math.max(1.2, scale * 0.05) }}
            options={face}
          />
        )}
      </>
    )
  }
}

// The faces are cut to the logo's rounded outline, so the block reads as the mark itself.
function talyxDrawing(
  face: FaceOptions | false,
  outline: string
): { viewBox: string; body: React.JSX.Element } {
  const inset = (TALYX_BOX - 226) / 2
  return {
    viewBox: `${-inset} 0 ${TALYX_BOX} ${TALYX_BOX}`,
    body: (
      <>
        <clipPath id={outline}>
          <path d={TALYX_SILHOUETTE} />
        </clipPath>
        <g clipPath={`url(#${outline})`}>
          <polygon points={pointList(TALYX.top)} fill={TALYX_TONES.top} />
          <polygon points={pointList(TALYX.left)} fill={TALYX_TONES.left} />
          <polygon points={pointList(TALYX.right)} fill={TALYX_TONES.right} />
        </g>
        {TALYX_CUTS.map((cut) => (
          <path key={cut} d={cut} fill={TALYX_TONES.stripe} />
        ))}
        {face && (
          <Face
            front={TALYX.front}
            pen={{ ink: TALYX_INK, tick: TALYX_TICK, width: TALYX_STROKE }}
            options={face}
          />
        )}
      </>
    )
  }
}

// Two tick eyes, a brow only while waiting, and a mouth of two halves that open into an angle.
function Face({
  front,
  pen,
  options
}: {
  front: Point[]
  pen: Pen
  options: FaceOptions
}): React.JSX.Element {
  const expression = EXPRESSIONS[options.state]
  const at = (u: number, v: number): Point => frontPoint(front, u, v)
  const [mouthX, mouthY] = at(0.5, 0.22)
  const half = pen.tick * 0.55
  const mouthHalf = (side: 1 | -1): React.JSX.Element => (
    <line
      x2={round(half * side * expression.mouth.length)}
      className="block-tick"
      style={{ transform: `rotate(${expression.mouth.angle * -side}deg)` }}
      {...stroke(pen)}
    />
  )
  return (
    <g>
      <g
        className={options.animated ? 'block-blink' : undefined}
        style={options.animated ? { animationDuration: options.blink } : undefined}
      >
        <Tick at={at(0.32, 0.6)} angle={expression.eyes[0]} length={pen.tick} pen={pen} />
        <Tick at={at(0.68, 0.6)} angle={expression.eyes[1]} length={pen.tick} pen={pen} />
      </g>
      <g style={{ opacity: expression.brow ? 1 : 0 }} className="block-tick">
        <Tick at={at(0.68, 0.8)} angle={-62} length={pen.tick * 1.1} pen={pen} />
      </g>
      <g transform={`translate(${round(mouthX)} ${round(mouthY)})`}>
        {mouthHalf(-1)}
        {mouthHalf(1)}
      </g>
    </g>
  )
}

interface Pen {
  ink: string
  tick: number
  width: number
}

// A segment centred on `at`; it turns about its centre, so a state change rotates it.
function Tick({
  at,
  angle,
  length,
  pen
}: {
  at: Point
  angle: number
  length: number
  pen: Pen
}): React.JSX.Element {
  return (
    <g transform={`translate(${round(at[0])} ${round(at[1])})`}>
      <line
        y1={round(-length / 2)}
        y2={round(length / 2)}
        className="block-tick"
        style={{ transform: `rotate(${-angle}deg)` }}
        {...stroke(pen)}
      />
    </g>
  )
}

function stroke(pen: Pen): React.SVGProps<SVGLineElement> {
  return { stroke: pen.ink, strokeWidth: round(pen.width), strokeLinecap: 'square' }
}

const round = (value: number): number => Math.round(value * 100) / 100

const pointList = (points: Point[]): string =>
  points.map(([x, y]) => `${round(x)},${round(y)}`).join(' ')
