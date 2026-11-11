// One isometric glyph per page in the footer dock, drawn like the bot blocks (three flat tones of one
// BLOCK_HUES hue), each built to say what its page holds.
import { BlockAvatar } from '@shared/ui/BlockAvatar'
import { blockTones } from '@shared/ui/blockGeometry'

export type PageGlyphName = 'agents' | 'module'

// x, y on the ground, z up; w, d, h the box's size along each. Listed back to front.
type Box = [x: number, y: number, z: number, w: number, d: number, h: number]

// Steps that climb, a run moving from one step to the next: every module's glyph until a module can
// hand Talyx a glyph of its own.
const MODULE_HUE = 9
const MODULE_BOXES: Box[] = [
  [0, 0, 0, 1, 1, 1],
  [1, 0, 0, 1, 1, 2],
  [2, 0, 0, 1, 1, 3]
]

const COS = Math.cos(Math.PI / 6)
const SIN = Math.sin(Math.PI / 6)
const project = (x: number, y: number, z: number): [number, number] => [
  (x - y) * COS,
  (x + y) * SIN - z
]

export function PageGlyph({
  name,
  size
}: {
  name: PageGlyphName
  size: number
}): React.JSX.Element {
  if (name === 'agents') return <BlockAvatar shape="talyx" hue={0} size={size} face={false} />
  const tones = blockTones(MODULE_HUE, false)
  // Each glyph lists its boxes back to front, so later boxes paint over earlier ones.
  const faces = MODULE_BOXES.flatMap(([x, y, z, w, d, h]) => [
    {
      fill: tones.top,
      points: [
        project(x, y, z + h),
        project(x + w, y, z + h),
        project(x + w, y + d, z + h),
        project(x, y + d, z + h)
      ]
    },
    {
      fill: tones.left,
      points: [
        project(x, y + d, z),
        project(x + w, y + d, z),
        project(x + w, y + d, z + h),
        project(x, y + d, z + h)
      ]
    },
    {
      fill: tones.right,
      points: [
        project(x + w, y, z),
        project(x + w, y + d, z),
        project(x + w, y + d, z + h),
        project(x + w, y, z + h)
      ]
    }
  ])
  const xs = faces.flatMap((f) => f.points.map((p) => p[0]))
  const ys = faces.flatMap((f) => f.points.map((p) => p[1]))
  const [minX, minY] = [Math.min(...xs), Math.min(...ys)]
  const side = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY)
  // Centre the drawing in a square box with a little margin, as BlockAvatar does.
  const pad = side * 0.04
  const view = [
    minX - (side - (Math.max(...xs) - minX)) / 2 - pad,
    minY - (side - (Math.max(...ys) - minY)) / 2 - pad,
    side + pad * 2,
    side + pad * 2
  ]
  return (
    <svg
      width={size}
      height={size}
      viewBox={view.join(' ')}
      aria-hidden="true"
      className="shrink-0"
    >
      {faces.map((f, i) => (
        <polygon key={i} points={f.points.map((p) => p.join(',')).join(' ')} fill={f.fill} />
      ))}
    </svg>
  )
}
