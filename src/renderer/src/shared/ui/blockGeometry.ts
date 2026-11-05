export const BLOCK_SHAPES = ['cube', 'tall', 'slab', 'stair', 'twin', 'tower'] as const
export type BlockShape = (typeof BLOCK_SHAPES)[number]

// Hue angles in oklch, in picker order; a bot's metadata stores the index.
export const BLOCK_HUES = [20, 50, 80, 110, 140, 170, 200, 230, 260, 285, 310, 340]

export type Point = [number, number]
export type Tone = 'top' | 'left' | 'right'

export interface BlockFace {
  points: Point[]
  tone: Tone
  // Draw order: a face with a higher depth is nearer and paints over lower ones.
  depth: number
  voxel: readonly [number, number, number]
}

export interface BlockGeometry {
  faces: BlockFace[]
  // The front face of the nearest top cube: where the face sits.
  frontIndex: number
  // Pixels per cube edge, for stroke widths.
  scale: number
}

type Voxel = [x: number, y: number, z: number]

const VOXELS: Record<BlockShape, Voxel[]> = {
  cube: [[0, 0, 0]],
  tall: [
    [0, 0, 0],
    [0, 0, 1]
  ],
  slab: [
    [0, 0, 0],
    [1, 0, 0]
  ],
  stair: [
    [0, 0, 0],
    [1, 0, 0],
    [1, 0, 1]
  ],
  twin: [
    [0, 0, 0],
    [0, 1, 0]
  ],
  tower: [
    [0, 0, 0],
    [0, 0, 1],
    [0, 0, 2]
  ]
}

// Share of the box the block fills; the margin keeps a turn of a few degrees inside it.
const FILL = 0.92

/**
 * An isometric block in `size` pixels, turned `yaw` degrees about its vertical axis. Cubes are
 * painted back to front, so hidden faces are covered rather than clipped.
 */
export function blockGeometry(shape: BlockShape, size: number, yaw = 0): BlockGeometry {
  const voxels = [...VOXELS[shape]].sort((a, b) => depthOf(a) - depthOf(b))
  const center = groundCenter(voxels)
  const front = frontVoxel(voxels)
  const draw = (turn: number): BlockFace[] =>
    voxels.flatMap((voxel) => cubeFaces(voxel, projection(turn, center), voxels))
  const still = draw(0)
  const turned = yaw ? draw(yaw) : still
  // The scale comes from the still block, so turning never changes its size.
  const [stillX, stillY, stillW, stillH] = bounds(still)
  const scale = (size * FILL) / Math.max(stillW, stillH)
  const [minX, minY, width, height] = yaw ? bounds(turned) : [stillX, stillY, stillW, stillH]
  const dx = (size - width * scale) / 2 - minX * scale
  const dy = (size - height * scale) / 2 - minY * scale
  const faces = turned.map((face) => ({
    ...face,
    points: face.points.map(([x, y]): Point => [x * scale + dx, y * scale + dy])
  }))
  const frontIndex = faces.findIndex((face) => face.tone === 'left' && face.voxel === front)
  return { faces, frontIndex, scale }
}

/** A point on the front face: `u` runs left to right, `v` bottom to top, both 0..1. */
export function frontPoint(front: Point[], u: number, v: number): Point {
  const [a, b, c, d] = front
  const low = lerp(a, b, u)
  const high = lerp(d, c, u)
  return lerp(low, high, v)
}

/** The three face tones of a hue and the ink for its face; offline drops the chroma. */
export function blockTones(
  hue: number,
  offline: boolean
): { top: string; left: string; right: string; ink: string } {
  const angle = BLOCK_HUES[hue] ?? BLOCK_HUES[0]
  const tone = (lightness: number, chroma: number): string =>
    `oklch(${lightness} ${offline ? 0 : chroma} ${angle})`
  return {
    top: tone(0.9, 0.07),
    left: tone(0.7, 0.13),
    right: tone(0.52, 0.13),
    ink: tone(0.3, 0.1)
  }
}

// A face against a neighbouring cube is never seen; leaving it out avoids seams at its edges.
function cubeFaces(voxel: Voxel, project: (point: Voxel) => Point, voxels: Voxel[]): BlockFace[] {
  const [x, y, z] = voxel
  const at = (dx: number, dy: number, dz: number): Point => project([x + dx, y + dy, z + dz])
  const sides: Array<[Tone, Voxel, Point[]]> = [
    ['top', [0, 0, 1], [at(0, 0, 1), at(1, 0, 1), at(1, 1, 1), at(0, 1, 1)]],
    ['left', [0, 1, 0], [at(0, 1, 0), at(1, 1, 0), at(1, 1, 1), at(0, 1, 1)]],
    ['right', [1, 0, 0], [at(1, 0, 0), at(1, 1, 0), at(1, 1, 1), at(1, 0, 1)]]
  ]
  const covered = ([dx, dy, dz]: Voxel): boolean =>
    voxels.some(([vx, vy, vz]) => vx === x + dx && vy === y + dy && vz === z + dz)
  return sides
    .filter(([, toward]) => !covered(toward))
    .map(([tone, , points]) => ({ tone, depth: depthOf(voxel), voxel, points }))
}

function projection(yaw: number, [cx, cy]: Point): (point: Voxel) => Point {
  const angle = (yaw * Math.PI) / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return ([x, y, z]) => {
    const rx = cx + (x - cx) * cos - (y - cy) * sin
    const ry = cy + (x - cx) * sin + (y - cy) * cos
    return [rx - ry, (rx + ry) / 2 - z]
  }
}

// The face goes on the nearest column's top cube; of two, the one further left.
function frontVoxel(voxels: Voxel[]): Voxel {
  const nearest = Math.max(...voxels.map(([, y]) => y))
  return voxels.filter(([, y]) => y === nearest).sort((a, b) => b[2] - a[2] || a[0] - b[0])[0]
}

function groundCenter(voxels: Voxel[]): Point {
  const xs = voxels.map(([x]) => x)
  const ys = voxels.map(([, y]) => y)
  return [(Math.min(...xs) + Math.max(...xs) + 1) / 2, (Math.min(...ys) + Math.max(...ys) + 1) / 2]
}

function bounds(faces: BlockFace[]): [x: number, y: number, width: number, height: number] {
  const points = faces.flatMap((face) => face.points)
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  const [minX, minY] = [Math.min(...xs), Math.min(...ys)]
  return [minX, minY, Math.max(...xs) - minX, Math.max(...ys) - minY]
}

const depthOf = ([x, y, z]: Voxel): number => x + y + z

const lerp = (p: Point, q: Point, k: number): Point => [
  p[0] + (q[0] - p[0]) * k,
  p[1] + (q[1] - p[1]) * k
]
