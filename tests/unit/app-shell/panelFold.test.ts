import { describe, expect, it } from 'vitest'
import { foldAfter } from '../../../src/renderer/src/widgets/app-shell/usePanelFold'

const wide = (view: string): { view: string; narrow: boolean } => ({ view, narrow: false })
const narrow = (view: string): { view: string; narrow: boolean } => ({ view, narrow: true })

describe('foldAfter', () => {
  it.each([
    ['a page opens in a wide window', wide('agents'), wide('settings'), false, true],
    ['a page opens in a narrow window', narrow('agents'), narrow('settings'), true, null],
    ['a page opens as the window narrows', wide('agents'), narrow('settings'), true, null],
    ['a page opens as the window widens', narrow('agents'), wide('settings'), null, true],
    ['the window narrows', wide('agents'), narrow('agents'), true, null],
    ['the window widens', narrow('agents'), wide('agents'), false, null],
    ['nothing changed after a fold', wide('agents'), wide('agents'), false, false],
    ['nothing changed after an unfold', narrow('agents'), narrow('agents'), true, true]
  ])('should give the right fold pick when %s', (_case, seen, now, choice, expected) => {
    expect(foldAfter(seen, now, choice)).toBe(expected)
  })
})
