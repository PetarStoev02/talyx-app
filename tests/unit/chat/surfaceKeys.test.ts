import { describe, expect, it } from 'vitest'
import { surfaceListKey } from '../../../src/renderer/src/features/chat/surfaceKeys'
import type { ChatItem } from '../../../src/renderer/src/features/chat/types'
const surface = (id: string, surfaceId: string): ChatItem => ({
  kind: 'surface',
  id,
  surface: {
    surfaceId,
    dataModel: {},
    components: [
      { id: 'root', component: 'Column', children: ['t'] },
      { id: 't', component: 'Text', text: 'Hi' }
    ]
  }
})

describe('surfaceListKey', () => {
  it('should stay the same when the row id changes but the surface id and place do not', () => {
    const items = [surface('stored-1', 'week'), surface('live-ui-x', 'week')]
    const stored = items[0] as Extract<ChatItem, { kind: 'surface' }>
    const live = items[1] as Extract<ChatItem, { kind: 'surface' }>
    expect(surfaceListKey(items, stored)).toBe('week:1')
    expect(surfaceListKey(items, live)).toBe('week:2')
    const reloaded = [surface('row-99', 'week'), live]
    expect(surfaceListKey(reloaded, reloaded[0] as Extract<ChatItem, { kind: 'surface' }>)).toBe(
      'week:1'
    )
  })

  it('should count occurrences per surface id only', () => {
    const items = [surface('a', 'one'), surface('b', 'two'), surface('c', 'one')]
    expect(surfaceListKey(items, items[2] as Extract<ChatItem, { kind: 'surface' }>)).toBe('one:2')
  })
})
