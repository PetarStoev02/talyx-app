import { describe, expect, it } from 'vitest'
import { MODULE_AVATARS } from '../../../src/renderer/src/features/modules/host'
import { BlockAvatar } from '../../../src/renderer/src/shared/ui/BlockAvatar'
import { BLOCK_HUES, BLOCK_SHAPES } from '../../../src/renderer/src/shared/ui/blockGeometry'

describe('the block avatars a module page gets from Talyx', () => {
  it('should be the avatar the roster draws', () => {
    expect(MODULE_AVATARS.BlockAvatar).toBe(BlockAvatar)
  })

  it('should offer every block shape and the number of hues, for a look picker', () => {
    expect(MODULE_AVATARS.shapes).toEqual(BLOCK_SHAPES)
    expect(MODULE_AVATARS.hueCount).toBe(BLOCK_HUES.length)
    expect(MODULE_AVATARS.hues).toEqual(BLOCK_HUES)
  })
})
