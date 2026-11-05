import { BLOCK_HUES, BLOCK_SHAPES } from '@shared/ui/blockGeometry'
import type { BlockShape } from '@shared/ui/blockGeometry'
import type { RosterBackend } from './data'
import type { Bot, BotMeta } from './types'

/** A bot's avatar: one of the block shapes in one of the hues, with or without its face. */
export interface Look {
  shape: BlockShape
  // An index into BLOCK_HUES.
  hue: number
  faces: boolean
}

// Below this oklab chroma an old colour reads as grey and has no hue to keep.
const GREY_CHROMA = 0.02

/** "Match the name": the profile id picks the shape and the hue, the same on every client. */
export function matchName(profile: string): Pick<Look, 'shape' | 'hue'> {
  const hash = fnv1a(profile)
  return {
    shape: BLOCK_SHAPES[hash % BLOCK_SHAPES.length],
    hue: (hash >>> 8) % BLOCK_HUES.length
  }
}

/**
 * The look a bot shows. Saved values win; an older client's (a blobatar id, a CSS colour) are
 * read as the nearest block; anything missing comes from the name. Nothing is written back.
 */
export function lookOf(bot: Pick<Bot, 'name' | 'meta'>): Look {
  const named = matchName(bot.name)
  return {
    shape: shapeOf(bot.meta.shape) ?? named.shape,
    hue: hueOf(bot.meta.color) ?? named.hue,
    faces: bot.meta.faces !== false
  }
}

/** The metadata fields a look is saved as; faces on is the default and is not stored. */
export function lookMeta(look: Look): Partial<BotMeta> {
  return { shape: look.shape, color: look.hue, faces: look.faces ? undefined : false }
}

export function sameLook(a: Look, b: Look): boolean {
  return a.shape === b.shape && a.hue === b.hue && a.faces === b.faces
}

/** Overwrites the profile's avatar image, so the engine's other surfaces show the block too. */
export async function exportAvatar(
  backend: RosterBackend,
  profile: string,
  look: Look
): Promise<void> {
  await backend.request(profile, 'profiles.set_asset', {
    name: profile,
    asset: 'avatar',
    data: await backend.avatarPng(look)
  })
}

function shapeOf(value: string | undefined): BlockShape | undefined {
  if (!value) return undefined
  const shape = BLOCK_SHAPES.find((item) => item === value)
  // An older client's shape (a blobatar id, a named outline) keeps one block per value.
  return shape ?? BLOCK_SHAPES[fnv1a(value) % BLOCK_SHAPES.length]
}

function hueOf(value: number | string | undefined): number | undefined {
  if (typeof value === 'number')
    return Number.isInteger(value) && value >= 0 && value < BLOCK_HUES.length ? value : undefined
  const angle = value === undefined ? undefined : oklchHue(value)
  if (angle === undefined) return undefined
  const distance = (hue: number): number => {
    const turn = Math.abs(hue - angle) % 360
    return Math.min(turn, 360 - turn)
  }
  return BLOCK_HUES.reduce(
    (best, hue, index) => (distance(hue) < distance(BLOCK_HUES[best]) ? index : best),
    0
  )
}

// The oklch hue of an `hsl(...)` or `#hex` colour, as older clients stored them.
function oklchHue(color: string): number | undefined {
  const rgb = hslToRgb(color) ?? hexToRgb(color)
  if (!rgb) return undefined
  const [r, g, b] = rgb.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  )
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  if (Math.hypot(a, bb) < GREY_CHROMA) return undefined
  return ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360
}

function hslToRgb(color: string): number[] | undefined {
  const match = /^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/i.exec(color.trim())
  if (!match) return undefined
  const [h, s, l] = [Number(match[1]), Number(match[2]) / 100, Number(match[3]) / 100]
  const a = s * Math.min(l, 1 - l)
  const f = (n: number): number => {
    const k = (n + h / 30) % 12
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return [f(0), f(8), f(4)]
}

function hexToRgb(color: string): number[] | undefined {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())
  if (!match) return undefined
  const hex =
    match[1].length === 3 ? [...match[1]].map((digit) => digit + digit).join('') : match[1]
  return [0, 2, 4].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255)
}

function fnv1a(text: string): number {
  let hash = 0x811c9dc5
  for (const char of text) {
    hash ^= char.codePointAt(0) ?? 0
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash
}
