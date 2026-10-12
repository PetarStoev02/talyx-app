import { z } from 'zod/v4'
import type { Capability, Proposal, ScreenImage } from '../model/Capability'
import type { Effect } from '../model/Effect'
import { OffScreenPointError, ScreenNotSeenError } from '../model/errors'
import { chordLabel, parseChord, type KeyChord } from './keyChords'

/** A capture of the display under the cursor, sized for the model. */
export interface Screenshot {
  image: ScreenImage
  /** Where that display sits in the global point space; (0, 0) for the primary one. */
  origin: Point
  /** Pixels of the image the model sees. */
  width: number
  height: number
  /** Image pixels per display point; below 1 when the capture was shrunk. */
  scale: number
}

/** In display points, the space the input driver works in. */
export interface Point {
  x: number
  y: number
}

export type MouseButton = 'left' | 'right'
export type ScrollDirection = 'up' | 'down' | 'left' | 'right'

export interface ScreenDeps {
  capture(): Promise<Screenshot>
  click(at: Point, button: MouseButton, count: number): Promise<void>
  /** One call for the whole text; the signal stops it mid-way. */
  type(text: string, signal: AbortSignal): Promise<void>
  press(chord: KeyChord): Promise<void>
  scroll(at: Point, direction: ScrollDirection, amount: number): Promise<void>
  now(): Date
}

export type ClickPayload = { at: Point; button: MouseButton; clicks: number }
export type TypePayload = { text: string }
export type ScrollPayload = { at: Point; direction: ScrollDirection; amount: number }

/**
 * The registry outlives any one conversation, so a screenshot from an earlier task
 * must not lend its coordinates to a guess in a new one.
 */
export const SEEN_FOR_MS = 2 * 60 * 1000
const LABEL_TEXT_LIMIT = 60

const SEES_SCREEN: Effect = { reversible: false, world: 'reads', discloses: 'content' }
/** Nothing un-clicks or un-types, so every one of these shows the card. */
const DRIVES_INPUT: Effect = { reversible: false, world: 'mutates', discloses: 'nothing' }

const CLICK_VERBS: Record<number, string> = { 1: 'Click', 2: 'Double-click', 3: 'Triple-click' }

const pixel = z.number().int().min(0)
const target = z
  .string()
  .min(1)
  .max(80)
  .describe('What is at that position, in a few words, e.g. "the Send button" — shown to the owner')

const chord = z
  .string()
  .min(1)
  .transform((value, ctx) => {
    try {
      return parseChord(value)
    } catch (err) {
      ctx.addIssue({ code: 'custom', message: (err as Error).message })
      return z.NEVER
    }
  })
  .describe('Key combination such as cmd+shift+p, return, escape or f5')

/**
 * The last resort for anything no other ability covers: look at the display under the cursor,
 * then click, type, press keys or scroll. Positions are pixels of the last
 * screenshot; the capability maps them to display points with that screenshot's scale.
 */
export function screenCapabilities(deps: ScreenDeps): Capability[] {
  let seen: Screenshot | null = null
  let seenAt = 0

  function toPoint(x: number, y: number): Point {
    if (!seen || deps.now().getTime() - seenAt > SEEN_FOR_MS) throw new ScreenNotSeenError()
    if (x >= seen.width || y >= seen.height)
      throw new OffScreenPointError(x, y, seen.width, seen.height)
    return {
      x: seen.origin.x + Math.round(x / seen.scale),
      y: seen.origin.y + Math.round(y / seen.scale)
    }
  }

  const look: Capability<Record<string, never>> = {
    name: 'look_at_screen',
    description:
      'Take a screenshot of the display the cursor is on. Only when no other tool can do the job: use it before click, type_text, press_keys or scroll',
    examples: ['what is on my screen', 'click the blue button', 'fill in this form'],
    params: z.object({}),
    effect: SEES_SCREEN,
    async plan(): Promise<Proposal> {
      seen = await deps.capture()
      seenAt = deps.now().getTime()
      return {
        kind: 'answer',
        summary: `Screenshot of the display under the cursor, ${seen.width}×${seen.height} pixels. Give click and scroll positions in these pixels.`,
        evidence: [],
        image: seen.image
      }
    }
  }

  const click: Capability<{
    x: number
    y: number
    target: string
    button: MouseButton
    clicks: number
  }> = {
    name: 'click',
    description: 'Click a position on the screen, from the last look_at_screen',
    examples: ['click Send', 'double-click the file', 'right-click the icon'],
    params: z.object({
      x: pixel,
      y: pixel,
      target,
      button: z.enum(['left', 'right']).default('left'),
      clicks: z.number().int().min(1).max(3).default(1)
    }),
    effect: DRIVES_INPUT,
    async plan({ x, y, target, button, clicks }): Promise<Proposal> {
      const at = toPoint(x, y)
      const verb = button === 'right' ? 'Right-click' : CLICK_VERBS[clicks]
      const label = `${verb} “${target}”`
      return {
        kind: 'plan',
        summary: label,
        operations: [
          {
            label,
            reason: `at ${x}, ${y} on the screen`,
            payload: { at, button, clicks } satisfies ClickPayload,
            inverse: null
          }
        ]
      }
    },
    async execute(op) {
      const { at, button, clicks } = op.payload as ClickPayload
      await deps.click(at, button, clicks)
    }
  }

  const typeText: Capability<{ text: string }> = {
    name: 'type_text',
    description:
      'Type text into whatever has keyboard focus on the screen. Newlines press Return; use press_keys for other keys',
    examples: ['type hello', 'write my address in the box'],
    params: z.object({ text: z.string().min(1).max(5000) }),
    effect: DRIVES_INPUT,
    async plan({ text }): Promise<Proposal> {
      const shown = text.length > LABEL_TEXT_LIMIT ? `${text.slice(0, LABEL_TEXT_LIMIT)}…` : text
      const label = `Type "${shown}"`
      return {
        kind: 'plan',
        summary: label,
        operations: [
          { label, reason: 'keyboard', payload: { text } satisfies TypePayload, inverse: null }
        ]
      }
    },
    async execute(op, ctx) {
      await deps.type((op.payload as TypePayload).text, ctx.signal)
    }
  }

  const pressKeys: Capability<{ keys: KeyChord }> = {
    name: 'press_keys',
    description: 'Press a key or keyboard shortcut in the app in front',
    examples: ['press enter', 'press cmd+s', 'hit escape'],
    params: z.object({ keys: chord }),
    effect: DRIVES_INPUT,
    async plan({ keys }): Promise<Proposal> {
      const label = `Press ${chordLabel(keys)}`
      return {
        kind: 'plan',
        summary: label,
        operations: [{ label, reason: 'keyboard', payload: keys, inverse: null }]
      }
    },
    async execute(op) {
      await deps.press(op.payload as KeyChord)
    }
  }

  const scroll: Capability<{
    x: number
    y: number
    target: string
    direction: ScrollDirection
    amount: number
  }> = {
    name: 'scroll',
    description: 'Scroll at a position on the screen, from the last look_at_screen',
    examples: ['scroll down', 'scroll the list up'],
    params: z.object({
      x: pixel,
      y: pixel,
      target,
      direction: z.enum(['up', 'down', 'left', 'right']),
      amount: z.number().int().min(1).max(30).default(5).describe('Lines to scroll')
    }),
    effect: DRIVES_INPUT,
    async plan({ x, y, target, direction, amount }): Promise<Proposal> {
      const at = toPoint(x, y)
      const label = `Scroll ${direction} in “${target}”`
      return {
        kind: 'plan',
        summary: label,
        operations: [
          {
            label,
            reason: `at ${x}, ${y} on the screen`,
            payload: { at, direction, amount } satisfies ScrollPayload,
            inverse: null
          }
        ]
      }
    },
    async execute(op) {
      const { at, direction, amount } = op.payload as ScrollPayload
      await deps.scroll(at, direction, amount)
    }
  }

  return [
    look as Capability,
    click as Capability,
    typeText as Capability,
    pressKeys as Capability,
    scroll as Capability
  ]
}
