import * as THREE from 'three'
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import type { Project } from '../../../../../shared/office'
import { deskPositions, roomCenter, type RoomWithBox } from './seats'

export interface Furniture {
  /** Conference room id → its table material (lit while anyone sits there). */
  tables: Map<string, THREE.MeshStandardMaterial>
  /** Work room id → one monitor screen material per desk, in desk order. */
  screens: Map<string, THREE.MeshStandardMaterial[]>
  t3Screen: THREE.MeshStandardMaterial | null
}

const FLOOR_COLOR: Record<RoomWithBox['kind'], number> = {
  conference: 0x1a1a1a,
  work: 0x202020,
  chill: 0x141414
}
const WALL_COLOR = 0x3a3a3a
const WALL_HEIGHT = 0.5
const FURNITURE_LIGHT = 0xd4d4d4
const FURNITURE_DARK = 0x2a2a2a
const PLANT_POT = 0x8a8a8a
const PLANT_LEAF = 0x5a5a5a
const SCREEN = 0x0a0a0a
const CITY_GREYS = [0x2c2c2c, 0x343434, 0x262626]
const CITY_HEIGHTS = [1.1, 1.7, 0.8, 2, 1.4, 1, 1.8]
const BUILDING_WIDTH = 1.4
const FIELD_GREYS = [0x1c1c1c, 0x262626]
const FIELD_STRIPS = 5
const VIEW_GAP = 1.2

/** Builds floors, walls, room labels and furniture for every room into `parent`. */
export function buildRooms(
  parent: THREE.Object3D,
  rooms: RoomWithBox[],
  windowView: Project['windowView']
): Furniture {
  const furniture: Furniture = { tables: new Map(), screens: new Map(), t3Screen: null }
  const bounds = floorBounds(rooms)
  box(parent, [bounds.w + 0.6, 0.3, bounds.d + 0.6], 0x0a0a0a, [bounds.cx, -0.16, bounds.cz])
  if (rooms.length > 0 && windowView === 'city') addCity(parent, bounds)
  if (rooms.length > 0 && windowView === 'fields') addFields(parent, bounds)

  for (const room of rooms) {
    addShell(parent, room)
    if (room.kind === 'conference') furniture.tables.set(room.id, addTable(parent, room))
    if (room.kind === 'work') {
      furniture.screens.set(room.id, addDesks(parent, room))
      furniture.t3Screen ??= addT3Terminal(parent, room)
    }
    if (room.kind === 'chill') addLounge(parent, room)
  }
  return furniture
}

export function floorBounds(rooms: RoomWithBox[]): {
  cx: number
  cz: number
  w: number
  d: number
} {
  if (rooms.length === 0) return { cx: 0, cz: 0, w: 1, d: 1 }
  const minX = Math.min(...rooms.map((r) => r.x))
  const maxX = Math.max(...rooms.map((r) => r.x + r.w))
  const minZ = Math.min(...rooms.map((r) => r.z))
  const maxZ = Math.max(...rooms.map((r) => r.z + r.d))
  return { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, w: maxX - minX, d: maxZ - minZ }
}

type Bounds = ReturnType<typeof floorBounds>

/** A row of grey boxes behind the back wall (the camera looks at the back from +z). */
function addCity(parent: THREE.Object3D, b: Bounds): void {
  const count = Math.ceil(b.w / BUILDING_WIDTH)
  const backZ = b.cz - b.d / 2 - VIEW_GAP
  for (let i = 0; i < count; i++) {
    const h = CITY_HEIGHTS[i % CITY_HEIGHTS.length]
    const x = b.cx - b.w / 2 + BUILDING_WIDTH * (i + 0.5)
    box(parent, [BUILDING_WIDTH - 0.15, h, 1], CITY_GREYS[i % CITY_GREYS.length], [x, h / 2, backZ])
  }
}

/** Flat grey strips stretching away behind the back wall. */
function addFields(parent: THREE.Object3D, b: Bounds): void {
  const backZ = b.cz - b.d / 2 - VIEW_GAP
  for (let i = 0; i < FIELD_STRIPS; i++) {
    const color = FIELD_GREYS[i % FIELD_GREYS.length]
    box(parent, [b.w + 4, 0.02, 0.9], color, [b.cx, -0.01, backZ - i])
  }
}

function addShell(parent: THREE.Object3D, room: RoomWithBox): void {
  const c = roomCenter(room)
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(room.w - 0.08, room.d - 0.08),
    material(FLOOR_COLOR[room.kind])
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.set(c.x, 0.001, c.z)
  floor.receiveShadow = true
  if (room.kind === 'conference' && room.groupId) floor.userData.groupId = room.groupId
  parent.add(floor)
  box(parent, [room.w, WALL_HEIGHT, 0.06], WALL_COLOR, [c.x, WALL_HEIGHT / 2, room.z])
  box(parent, [0.06, WALL_HEIGHT, room.d], WALL_COLOR, [room.x, WALL_HEIGHT / 2, c.z])

  const el = document.createElement('div')
  el.className = 'text-xs whitespace-nowrap text-[#949494]'
  el.textContent = room.name
  const tag = new CSS2DObject(el)
  tag.position.set(c.x, 0.05, room.z + 0.45)
  parent.add(tag)
}

function addTable(parent: THREE.Object3D, room: RoomWithBox): THREE.MeshStandardMaterial {
  const c = roomCenter(room)
  const top = material(FURNITURE_LIGHT, { emissive: 0xffffff, emissiveIntensity: 0 })
  const table = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.08, 40), top)
  table.scale.set(1.25, 1, 0.8)
  table.position.set(c.x, 0.55, c.z)
  table.castShadow = table.receiveShadow = true
  parent.add(table)
  box(parent, [0.15, 0.5, 0.15], 0x333338, [c.x, 0.27, c.z])
  return top
}

function addDesks(parent: THREE.Object3D, room: RoomWithBox): THREE.MeshStandardMaterial[] {
  return deskPositions(room).map(({ x, z }) => {
    box(parent, [1.3, 0.06, 0.7], FURNITURE_LIGHT, [x, 0.5, z])
    return litScreen(parent, [0.6, 0.38, 0.04], [x, 0.75, z - 0.25])
  })
}

function addT3Terminal(parent: THREE.Object3D, room: RoomWithBox): THREE.MeshStandardMaterial {
  const x = roomCenter(room).x
  box(parent, [0.7, 0.9, 0.4], FURNITURE_DARK, [x, 0.45, room.z + 0.4])
  return litScreen(parent, [0.5, 0.35, 0.02], [x, 0.6, room.z + 0.61])
}

function addLounge(parent: THREE.Object3D, room: RoomWithBox): void {
  const c = roomCenter(room)
  const backZ = room.z + room.d - 0.6
  box(parent, [2.4, 0.35, 0.7], FURNITURE_DARK, [room.x + 3, 0.18, backZ])
  box(parent, [2.4, 0.35, 0.7], FURNITURE_DARK, [room.x + room.w - 3, 0.18, backZ])
  box(parent, [1.2, 0.3, 0.8], 0x333333, [c.x, 0.15, backZ - 0.1])
  for (const [x, z] of [
    [room.x + 0.5, room.z + 0.5],
    [room.x + room.w - 0.5, room.z + 0.5],
    [room.x + room.w - 0.5, room.z + room.d - 0.5]
  ]) {
    box(parent, [0.35, 0.4, 0.35], PLANT_POT, [x, 0.2, z])
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), material(PLANT_LEAF))
    leaf.position.set(x, 0.7, z)
    leaf.castShadow = true
    parent.add(leaf)
  }
}

function litScreen(
  parent: THREE.Object3D,
  [w, h, d]: [number, number, number],
  at: [number, number, number]
): THREE.MeshStandardMaterial {
  const screen = material(SCREEN, { emissive: 0xffffff, emissiveIntensity: 0 })
  box(parent, [w, h, d], screen, at)
  return screen
}

function box(
  parent: THREE.Object3D,
  [w, h, d]: [number, number, number],
  look: number | THREE.Material,
  [x, y, z]: [number, number, number]
): void {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    typeof look === 'number' ? material(look) : look
  )
  mesh.position.set(x, y, z)
  mesh.castShadow = mesh.receiveShadow = true
  parent.add(mesh)
}

function material(
  color: number,
  extra: THREE.MeshStandardMaterialParameters = {}
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra })
}

/** Frees GPU resources and label DOM under `root`, then detaches it. */
export function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose()
      ;(o.material as THREE.Material).dispose()
    }
    if (o instanceof CSS2DObject) o.element.remove()
  })
  root.removeFromParent()
}
