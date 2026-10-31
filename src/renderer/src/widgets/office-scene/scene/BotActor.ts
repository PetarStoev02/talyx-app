import * as THREE from 'three'
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import type { OfficeSnapshot } from '../../../../../shared/office'
import { disposeTree } from './buildRooms'
import type { Seat } from './seats'

export type SceneBot = OfficeSnapshot['bots'][number]

const WALK_SPEED = 2.2
const ARRIVED = 0.05
const BUBBLE_MS = 6000
const STALE_OPACITY = 0.4
const BODY_Y = 0.3
const LABEL_Y = 0.85

/** One bot in the office: body, eyes, selection ring and its CSS2D label. Walks to its seat. */
export class BotActor {
  readonly group = new THREE.Group()
  readonly body: THREE.Mesh
  private readonly ring: THREE.Mesh
  private readonly bodyMaterial: THREE.MeshStandardMaterial
  private readonly eyeMaterial: THREE.MeshStandardMaterial
  private readonly label: HTMLDivElement
  private readonly bubble: HTMLDivElement
  private readonly hand: HTMLDivElement
  private readonly nameTag: HTMLDivElement
  private readonly target = new THREE.Vector3()
  private readonly face = new THREE.Vector3()
  private readonly step = new THREE.Vector3()
  private lastLine: string | null
  private bubbleTimer: ReturnType<typeof setTimeout> | null = null

  constructor(bot: SceneBot, seat: Seat, onSelect: (botId: string) => void) {
    this.bodyMaterial = new THREE.MeshStandardMaterial({ color: bot.color, roughness: 0.45 })
    this.body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), this.bodyMaterial)
    this.body.scale.set(1.15, 0.85, 1)
    this.body.position.y = BODY_Y
    this.body.castShadow = true
    this.body.userData.botId = bot.id
    this.group.add(this.body)

    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.48, 40),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    )
    this.ring.rotation.x = -Math.PI / 2
    this.ring.position.y = 0.01
    this.ring.visible = false
    this.group.add(this.ring)

    this.eyeMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.3,
      roughness: 0.8
    })
    const eyeGeometry = new THREE.SphereGeometry(0.045, 10, 8)
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeometry, this.eyeMaterial)
      eye.scale.set(0.8, 1.5, 0.6)
      eye.position.set(side * 0.09, 0.36, 0.27)
      this.group.add(eye)
    }

    this.label = div('flex cursor-pointer flex-col items-center pointer-events-auto')
    this.bubble = div(
      'mb-1.5 hidden max-w-[190px] rounded-lg bg-white px-2.5 py-1.5 text-xs leading-4 text-black'
    )
    this.hand = div(
      'mb-1 hidden rounded-full bg-white px-1.5 text-[11px] leading-4 font-semibold text-black'
    )
    this.hand.textContent = '!'
    this.nameTag = div(
      'rounded-full border border-[#2e2e2e] bg-[#111] px-2 py-px text-[11px] leading-4 whitespace-nowrap text-white'
    )
    this.label.append(this.bubble, this.hand, this.nameTag)
    this.label.addEventListener('click', () => onSelect(bot.id))
    const tag = new CSS2DObject(this.label)
    tag.position.y = LABEL_Y
    this.group.add(tag)

    this.lastLine = bot.placement.lastLine
    this.update(bot, seat)
    this.group.position.copy(this.target)
  }

  update(bot: SceneBot, seat: Seat): void {
    this.target.set(seat.x, 0, seat.z)
    this.face.set(seat.faceX, 0, seat.faceZ)
    this.nameTag.textContent = bot.name
    this.bodyMaterial.color.set(bot.color)
    this.hand.style.display = bot.placement.waiting ? 'block' : 'none'
    this.setStale(bot.placement.stale)
    if (bot.placement.lastLine !== this.lastLine) {
      this.lastLine = bot.placement.lastLine
      if (this.lastLine) this.say(this.lastLine)
    }
  }

  setSelected(selected: boolean): void {
    this.ring.visible = selected
  }

  tick(dt: number, time: number): void {
    const p = this.group.position
    this.step.subVectors(this.target, p)
    const dist = this.step.length()
    const walking = dist > ARRIVED
    if (walking) {
      p.addScaledVector(this.step.normalize(), Math.min(dist, dt * WALK_SPEED))
      this.group.rotation.y = Math.atan2(this.step.x, this.step.z)
    } else {
      this.group.rotation.y = Math.atan2(this.face.x - p.x, this.face.z - p.z)
    }
    this.body.position.y =
      BODY_Y + (walking ? Math.abs(Math.sin(time * 12)) * 0.08 : Math.sin(time * 2 + p.x) * 0.02)
  }

  dispose(): void {
    if (this.bubbleTimer) clearTimeout(this.bubbleTimer)
    disposeTree(this.group)
  }

  private say(line: string): void {
    this.bubble.textContent = line
    this.bubble.style.display = 'block'
    if (this.bubbleTimer) clearTimeout(this.bubbleTimer)
    this.bubbleTimer = setTimeout(() => {
      this.bubble.style.display = 'none'
      this.bubbleTimer = null
    }, BUBBLE_MS)
  }

  private setStale(stale: boolean): void {
    for (const m of [this.bodyMaterial, this.eyeMaterial]) {
      if (m.transparent !== stale) m.needsUpdate = true
      m.transparent = stale
      m.opacity = stale ? STALE_OPACITY : 1
    }
    this.label.style.opacity = stale ? String(STALE_OPACITY) : '1'
  }
}

function div(className: string): HTMLDivElement {
  const el = document.createElement('div')
  el.className = className
  return el
}
