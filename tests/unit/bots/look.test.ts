import { describe, expect, it } from 'vitest'
import { lookMeta, lookOf, matchName } from '../../../src/renderer/src/features/bots/look'
import type { BotMeta } from '../../../src/renderer/src/features/bots/types'
import { BLOCK_HUES, BLOCK_SHAPES } from '../../../src/renderer/src/shared/ui/blockGeometry'

// A profile id whose own hue (10) differs from every colour mapped below.
const NAME = 'bot-14'
const named = matchName(NAME)

describe('bot looks', () => {
  describe('matchName', () => {
    it('should give a name the same look every time', () => {
      expect(matchName('analyst')).toEqual({ shape: 'tall', hue: 9 })
      expect(matchName('writer')).toEqual({ shape: 'cube', hue: 5 })
      expect(matchName('analyst')).toEqual(matchName('analyst'))
    })

    it('should tell names apart that differ by one letter', () => {
      expect(matchName('bot-1')).not.toEqual(matchName('bot-2'))
    })

    it.each(BLOCK_SHAPES)('should give some name the %s shape', (shape) => {
      const names = Array.from({ length: 50 }, (_, n) => `bot-${n}`)
      expect(names.some((name) => matchName(name).shape === shape)).toBe(true)
    })

    it.each(BLOCK_HUES.map((_, index) => index))('should give some name hue %i', (hue) => {
      const names = Array.from({ length: 50 }, (_, n) => `bot-${n}`)
      expect(names.some((name) => matchName(name).hue === hue)).toBe(true)
    })
  })

  describe('lookOf', () => {
    it.each<[string, BotMeta, { shape: string; hue: number }]>([
      ['no saved look', {}, named],
      ['a saved shape and hue', { shape: 'stair', color: 3 }, { shape: 'stair', hue: 3 }],
      ['only a saved shape', { shape: 'twin' }, { shape: 'twin', hue: named.hue }],
      [
        'an older blobatar and hsl colour',
        { shape: 'blobatar:opkylh55', color: 'hsl(150 68% 58%)' },
        { shape: 'tall', hue: 5 }
      ],
      ['an older hex colour', { color: '#8b5cf6' }, { shape: named.shape, hue: 9 }],
      ['an older comma hsl colour', { color: 'hsl(0, 80%, 50%)' }, { shape: named.shape, hue: 0 }],
      ['a grey colour, which has no hue', { color: 'hsl(0 0% 50%)' }, named],
      ['a hue index out of range', { color: 12 }, named],
      ['a fractional hue index', { color: 2.5 }, named],
      ['an unreadable colour', { color: 'tomato' }, named]
    ])('should draw a bot with %s', (_, meta, expected) => {
      expect(lookOf({ name: NAME, meta })).toEqual({ ...expected, faces: true })
    })

    it('should map an older shape name to the same block on every read', () => {
      const circle = lookOf({ name: 'a', meta: { shape: 'circle' } }).shape
      expect(lookOf({ name: 'b', meta: { shape: 'circle' } }).shape).toBe(circle)
    })

    it('should hide the face only when the bot turned it off', () => {
      expect(lookOf({ name: NAME, meta: { faces: false } }).faces).toBe(false)
      expect(lookOf({ name: NAME, meta: { faces: true } }).faces).toBe(true)
    })
  })

  describe('lookMeta', () => {
    it('should store the shape name and hue index, and the face only when it is off', () => {
      expect(lookMeta({ shape: 'tower', hue: 7, faces: true })).toEqual({
        shape: 'tower',
        color: 7
      })
      expect(lookMeta({ shape: 'tower', hue: 7, faces: false })).toEqual({
        shape: 'tower',
        color: 7,
        faces: false
      })
    })

    it('should read back what it stores', () => {
      const look = { shape: 'slab' as const, hue: 11, faces: false }
      expect(lookOf({ name: NAME, meta: lookMeta(look) })).toEqual(look)
    })
  })
})
