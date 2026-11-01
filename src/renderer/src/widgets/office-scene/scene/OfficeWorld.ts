import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import type { ConversationTarget, OfficeSnapshot } from '../../../../../shared/office'
import { BotActor, type SceneBot } from './BotActor'
import { buildRooms, disposeTree, floorBounds, type Furniture } from './buildRooms'
import { deskPositions, seatFor, type RoomWithBox, type Seat } from './seats'

/** Width kept free on the right for the chat panel (the roster is narrower). */
export const PANEL_WIDTH = 360
const FOV = 32
const MAX_POLAR = 1.3
const MIN_DISTANCE = 14
const FRAME_MARGIN = 1
const MAX_DT = 0.05
const CLICK_SLOP_PX = 4
const TABLE_LIT = 0.12
const SCREEN_LIT = 0.55
const T3_LIT = 0.55

/** Owns the three.js scene for one mounted OfficeScene. */
export class OfficeWorld {
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200)
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true })
  private readonly labels = new CSS2DRenderer()
  private readonly controls: OrbitControls
  private readonly sun = new THREE.DirectionalLight(0xffffff, 1.6)
  private readonly actors = new Map<string, BotActor>()
  private readonly resizeObserver: ResizeObserver
  private readonly raycaster = new THREE.Raycaster()
  private rooms = new THREE.Group()
  private furniture: Furniture = { tables: new Map(), screens: new Map(), t3Screen: null }
  private roomsKey = ''
  private bounds = floorBounds([])
  private selectedBotId: string | null = null
  private frameId = 0
  private lastTime = performance.now()
  private pointerDown: { x: number; y: number } | null = null

  constructor(
    private readonly container: HTMLElement,
    private readonly onSelect: (target: ConversationTarget) => void
  ) {
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.shadowMap.enabled = true
    container.appendChild(this.renderer.domElement)
    Object.assign(this.labels.domElement.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      pointerEvents: 'none'
    })
    container.appendChild(this.labels.domElement)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.maxPolarAngle = MAX_POLAR

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x111111, 1.1))
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    Object.assign(this.sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14 })
    this.scene.add(this.sun, this.sun.target, this.rooms)

    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown)
    this.renderer.domElement.addEventListener('pointerup', this.handlePointerUp)
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()
    this.frameId = requestAnimationFrame(this.frame)
  }

  apply(snapshot: OfficeSnapshot): void {
    this.syncRooms(snapshot.rooms, snapshot.project.windowView)
    const seats = seatBots(snapshot)
    for (const [id, actor] of this.actors) {
      if (seats.has(id)) continue
      actor.dispose()
      this.actors.delete(id)
    }
    for (const bot of snapshot.bots) {
      const seat = seats.get(bot.id)
      if (!seat) continue
      const actor = this.actors.get(bot.id)
      if (actor) actor.update(bot, seat)
      else this.addActor(bot, seat)
    }
    this.lightFurniture(snapshot)
    this.select(this.selectedBotId)
  }

  select(botId: string | null): void {
    this.selectedBotId = botId
    for (const [id, actor] of this.actors) actor.setSelected(id === botId)
  }

  dispose(): void {
    cancelAnimationFrame(this.frameId)
    this.resizeObserver.disconnect()
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown)
    this.renderer.domElement.removeEventListener('pointerup', this.handlePointerUp)
    this.controls.dispose()
    for (const actor of this.actors.values()) actor.dispose()
    this.actors.clear()
    disposeTree(this.rooms)
    this.sun.shadow.map?.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
    this.labels.domElement.remove()
  }

  private addActor(bot: SceneBot, seat: Seat): void {
    const actor = new BotActor(bot, seat, (botId) => this.onSelect({ kind: 'bot', botId }))
    this.actors.set(bot.id, actor)
    this.scene.add(actor.group)
  }

  private syncRooms(
    rooms: RoomWithBox[],
    windowView: OfficeSnapshot['project']['windowView']
  ): void {
    const key = JSON.stringify([rooms, windowView])
    if (key === this.roomsKey) return
    this.roomsKey = key
    disposeTree(this.rooms)
    this.rooms = new THREE.Group()
    this.scene.add(this.rooms)
    this.furniture = buildRooms(this.rooms, rooms, windowView)
    this.bounds = floorBounds(rooms)
    this.frameCamera()
  }

  private lightFurniture(snapshot: OfficeSnapshot): void {
    const occupied = new Set(snapshot.bots.map((b) => b.placement.roomId))
    for (const [roomId, table] of this.furniture.tables) {
      table.emissiveIntensity = occupied.has(roomId) ? TABLE_LIT : 0
    }
    for (const [roomId, screens] of this.furniture.screens) {
      const workers = snapshot.bots.filter((b) => b.placement.roomId === roomId).length
      screens.forEach((s, i) => (s.emissiveIntensity = i < workers ? SCREEN_LIT : 0))
    }
    if (this.furniture.t3Screen) {
      this.furniture.t3Screen.emissiveIntensity = snapshot.t3Connected ? T3_LIT : 0
    }
  }

  /** Frontal view, distance fitted so the whole floor fits left of the panel. */
  private frameCamera(): void {
    const b = this.bounds
    this.controls.target.set(b.cx, 0, b.cz)
    const { width, height } = this.size()
    const aspect = Math.max(width - PANEL_WIDTH, 320) / height
    const halfH = Math.atan(Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * aspect)
    const distance = Math.max((b.w / 2 + FRAME_MARGIN) / Math.tan(halfH), MIN_DISTANCE)
    this.camera.position
      .copy(this.controls.target)
      .add(new THREE.Vector3(0, 0.8, 0.6).multiplyScalar(distance))
    this.sun.position.set(b.cx + 6, 20, b.cz + 7.5)
    this.sun.target.position.set(b.cx, 0, b.cz)
    this.controls.update()
  }

  private resize(): void {
    const { width, height } = this.size()
    this.renderer.setSize(width, height)
    this.labels.setSize(width, height)
    this.camera.aspect = width / height
    this.camera.setViewOffset(width, height, PANEL_WIDTH / 2, 0, width, height)
    this.camera.updateProjectionMatrix()
    this.frameCamera()
  }

  private size(): { width: number; height: number } {
    return {
      width: Math.max(this.container.clientWidth, 1),
      height: Math.max(this.container.clientHeight, 1)
    }
  }

  private readonly frame = (now: number): void => {
    const dt = Math.min((now - this.lastTime) / 1000, MAX_DT)
    this.lastTime = now
    for (const actor of this.actors.values()) actor.tick(dt, now / 1000)
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
    this.labels.render(this.scene, this.camera)
    this.frameId = requestAnimationFrame(this.frame)
  }

  private readonly handlePointerDown = (e: PointerEvent): void => {
    this.pointerDown = { x: e.clientX, y: e.clientY }
  }

  // A click selects the bot under the pointer, else the conference room; a drag is the orbit control's.
  private readonly handlePointerUp = (e: PointerEvent): void => {
    const down = this.pointerDown
    this.pointerDown = null
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > CLICK_SLOP_PX) return
    const rect = this.renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    )
    this.raycaster.setFromCamera(ndc, this.camera)
    const bodies = [...this.actors.values()].map((a) => a.body)
    const bot = this.raycaster.intersectObjects(bodies, false)[0]
    if (bot) return this.onSelect({ kind: 'bot', botId: bot.object.userData.botId as string })
    const floors = this.rooms.children.filter((o) => o.userData.groupId)
    const room = this.raycaster.intersectObjects(floors, false)[0]
    if (room) this.onSelect({ kind: 'group', groupId: room.object.userData.groupId as string })
  }
}

/** Each bot's seat: its index among the bots in the same room, ordered by id. */
function seatBots(snapshot: OfficeSnapshot): Map<string, Seat> {
  const seats = new Map<string, Seat>()
  for (const room of snapshot.rooms) {
    const inRoom = snapshot.bots
      .filter((b) => b.placement.roomId === room.id)
      .sort((a, b) => a.id.localeCompare(b.id))
    const deskCount = room.kind === 'work' ? deskPositions(room).length : 0
    inRoom.forEach((bot, index) =>
      seats.set(bot.id, seatFor({ room, index, count: inRoom.length, deskCount }))
    )
  }
  return seats
}
