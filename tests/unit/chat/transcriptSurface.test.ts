import { describe, expect, it } from 'vitest'
import { MCP_UI_CATALOG } from '../../../src/shared/a2uiSurface'
import { fromHistory } from '../../../src/renderer/src/features/chat/transcript'
import {
  liveSurfaceId,
  mergeLiveSurfaces
} from '../../../src/renderer/src/features/chat/surfaceLive'
import type { ChatItem } from '../../../src/renderer/src/features/chat/types'

const messagesPayload = [
  {
    version: '1.0',
    createSurface: { surfaceId: 'week', catalogId: MCP_UI_CATALOG }
  },
  {
    version: '1.0',
    updateComponents: {
      surfaceId: 'week',
      components: [
        { id: 'root', component: 'Column', children: ['t'] },
        { id: 't', component: 'Text', text: 'Hi' }
      ]
    }
  }
]

describe('transcript surfaces', () => {
  it('should turn a direct stored show_ui tool row into a surface item', () => {
    const transcript = fromHistory(
      'chat-1',
      [
        {
          row_id: 1,
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              id: 'call-1',
              function: {
                name: 'mcp__talyx__show_ui',
                arguments: JSON.stringify({ messages: messagesPayload })
              }
            }
          ]
        },
        {
          row_id: 2,
          role: 'tool',
          tool_call_id: 'call-1',
          name: 'mcp__talyx__show_ui',
          args: { messages: messagesPayload }
        }
      ],
      false
    )
    expect(transcript.items.some((item) => item.kind === 'surface')).toBe(true)
    expect(transcript.items.some((item) => item.kind === 'tool')).toBe(false)
  })

  it('should read show_ui inside an engine tool_call wrapper', () => {
    const wrapper = {
      calls: [{ name: 'mcp__talyx__show_ui', arguments: { messages: messagesPayload } }]
    }
    const transcript = fromHistory(
      'chat-1',
      [
        {
          row_id: 1,
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              id: 'call-2',
              function: { name: 'tool_call', arguments: JSON.stringify(wrapper) }
            }
          ]
        },
        {
          row_id: 2,
          role: 'tool',
          tool_call_id: 'call-2',
          name: 'tool_call',
          args: wrapper
        }
      ],
      false
    )
    expect(transcript.items.filter((item) => item.kind === 'surface')).toHaveLength(1)
  })

  it("should read show_ui as the engine serves it: the tool's name on the row, the wrapper on the call", () => {
    const wrapper = {
      calls: [{ name: 'mcp__talyx__show_ui', arguments: { messages: messagesPayload } }]
    }
    const transcript = fromHistory(
      'chat-1',
      [
        {
          id: 6,
          role: 'assistant',
          content: '',
          tool_calls: [
            { id: 'call-9', function: { name: 'tool_call', arguments: JSON.stringify(wrapper) } }
          ]
        },
        { id: 7, role: 'tool', tool_call_id: 'call-9', tool_name: 'mcp__talyx__show_ui' },
        { id: 8, role: 'assistant', content: 'One comment.' }
      ] as never,
      false
    )
    expect(transcript.items.map((item) => item.kind)).toEqual(['surface', 'bot'])
  })

  it('should skip a refused surface but keep an ordinary tool row', () => {
    const transcript = fromHistory(
      'chat-1',
      [
        {
          row_id: 2,
          role: 'tool',
          tool_call_id: 'call-3',
          name: 'mcp__talyx__show_ui',
          args: {
            messages: [{ version: '1.0', createSurface: { surfaceId: 'x', catalogId: 'bad' } }]
          }
        }
      ],
      false
    )
    expect(transcript.items.some((item) => item.kind === 'surface')).toBe(false)
    expect(transcript.items.some((item) => item.kind === 'tool')).toBe(true)
  })

  it('should keep exactly one surface after live add then history reload', () => {
    const stored: ChatItem[] = [
      {
        kind: 'surface',
        id: 'stored',
        toolCallId: 'call-1',
        surface: { surfaceId: 'week', components: [], dataModel: {} }
      }
    ]
    const live: ChatItem[] = [
      {
        kind: 'surface',
        id: liveSurfaceId('live-1'),
        toolCallId: liveSurfaceId('live-1'),
        surface: { surfaceId: 'week', components: [], dataModel: {} }
      }
    ]
    const merged = mergeLiveSurfaces(stored, live)
    expect(merged.filter((item) => item.kind === 'surface')).toHaveLength(1)
  })
})
