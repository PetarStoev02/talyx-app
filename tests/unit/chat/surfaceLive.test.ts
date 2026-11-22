import { describe, expect, it } from 'vitest'
import { mergeLiveSurfaces } from '../../../src/renderer/src/features/chat/surfaceLive'
import type { ChatItem } from '../../../src/renderer/src/features/chat/types'

const mk = (id: string, surfaceId: string, text: string): ChatItem => ({
  kind: 'surface',
  id,
  surface: {
    surfaceId,
    dataModel: {},
    components: [
      { id: 'root', component: 'Column', children: ['t'] },
      { id: 't', component: 'Text', text }
    ]
  }
})

describe('mergeLiveSurfaces', () => {
  it('should drop one live card when stored content matches and keep another with the same surface id', () => {
    const stored: ChatItem[] = [mk('stored', 'dup', 'First')]
    const live: ChatItem[] = [mk('live-ui-1', 'dup', 'First'), mk('live-ui-2', 'dup', 'Second')]
    const merged = mergeLiveSurfaces(stored, live)
    expect(merged.filter((item) => item.kind === 'surface')).toHaveLength(2)
    expect(merged.some((item) => item.id === 'live-ui-2')).toBe(true)
    expect(merged.some((item) => item.id === 'live-ui-1')).toBe(false)
  })
})
