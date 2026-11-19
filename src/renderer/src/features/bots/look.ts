import { BLOCK_SHAPES, type BlockShape } from '@contract/moduleHost'
import { BLOCK_HUES } from '@shared/ui/blockGeometry'
import { fnv1a, oklchHue } from '@shared/lib/color'
import type { Bot, BotMeta } from './types'

export interface AvatarBackend {
  /** Overwrites the profile's avatar image with the block, so the engine's other surfaces show it. */
  setAvatar: (profile: string, look: Look) => Promise<void>
}

/** A bot's avatar: one of the block shapes in one of the hues, with or without its face. */
export interface Look {
  shape: BlockShape
  // An index into BLOCK_HUES.
  hue: number
  faces: boolean
}

// The hue reads the hash's next byte, so shape and hue vary apart.
const HUE_SHIFT = 8
const FULL_TURN = 360

/** "Match the name": the profile id picks the shape and the hue, the same on every client. */
export function matchName(profile: string): Pick<Look, 'shape' | 'hue'> {
  const hash = fnv1a(profile)
  return {
    // A remainder of the length is always an index of the (non-empty) shape list.
    shape: BLOCK_SHAPES[hash % BLOCK_SHAPES.length]!,
    hue: (hash >>> HUE_SHIFT) % BLOCK_HUES.length
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
export function lookMeta(look: Look): Pick<BotMeta, 'shape' | 'color' | 'faces'> {
  return { shape: look.shape, color: look.hue, faces: look.faces ? null : false }
}

export function sameLook(a: Look, b: Look): boolean {
  return a.shape === b.shape && a.hue === b.hue && a.faces === b.faces
}

/** Overwrites the profile's avatar image, so the engine's other surfaces show the block too. */
export function exportAvatar(backend: AvatarBackend, profile: string, look: Look): Promise<void> {
  return backend.setAvatar(profile, look)
}

function shapeOf(value: string | null): BlockShape | undefined {
  if (!value) return undefined
  const shape = BLOCK_SHAPES.find((item) => item === value)
  // An older client's shape (a blobatar id, a named outline) keeps one block per value.
  return shape ?? BLOCK_SHAPES[fnv1a(value) % BLOCK_SHAPES.length]
}

function hueOf(value: number | string | null): number | undefined {
  if (typeof value === 'number')
    return Number.isInteger(value) && value >= 0 && value < BLOCK_HUES.length ? value : undefined
  const angle = typeof value === 'string' ? oklchHue(value) : undefined
  // An unreadable stored colour (NaN) falls back like a missing one.
  if (angle === undefined || Number.isNaN(angle)) return undefined
  const distance = (hue: number): number => {
    const turn = Math.abs(hue - angle) % FULL_TURN
    return Math.min(turn, FULL_TURN - turn)
  }
  const distances = BLOCK_HUES.map(distance)
  return distances.indexOf(Math.min(...distances))
}
