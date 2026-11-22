import { describe, expect, it } from 'vitest'
import { MCP_UI_CATALOG, parseA2uiMessages } from '../../src/shared/a2uiSurface'

const baseCreate = (surfaceId: string): unknown[] => [
  { version: '1.0', createSurface: { surfaceId, catalogId: MCP_UI_CATALOG } }
]

function components(surfaceId: string, components: unknown[]): unknown[] {
  return [...baseCreate(surfaceId), { version: '1.0', updateComponents: { surfaceId, components } }]
}

describe('parseA2uiMessages', () => {
  it('should accept one valid surface per component kind', () => {
    const messages = components('demo', [
      { id: 'root', component: 'Column', children: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'] },
      { id: 'a', component: 'Text', text: 'Hi', variant: 'heading' },
      { id: 'b', component: 'Divider' },
      { id: 'c', component: 'Stat', label: 'Tokens', value: '1M', note: '+9%', tone: 'up' },
      {
        id: 'd',
        component: 'Chart',
        kind: 'bar',
        labels: ['Mon'],
        series: [{ name: 'T', values: [1] }]
      },
      {
        id: 'e',
        component: 'Table',
        columns: [{ label: 'A' }],
        rows: [['x']]
      },
      { id: 'lbl', component: 'Text', text: 'Go' },
      { id: 'f', component: 'Button', child: 'lbl', action: { event: { name: 'go' } } },
      {
        id: 'g',
        component: 'ChoicePicker',
        label: 'Day',
        options: [{ label: 'Wed', value: 'w' }],
        value: { '@path': '/day' }
      },
      {
        id: 'h',
        component: 'TextField',
        label: 'Name',
        value: { '@path': '/name' }
      },
      { id: 'i', component: 'Row', children: ['lbl'] }
    ])
    expect(parseA2uiMessages(messages).ok).toBe(true)
  })

  it('should refuse a surface with no root', () => {
    const result = parseA2uiMessages(
      components('x', [{ id: 'only', component: 'Text', text: 'Hi' }])
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('root')
  })

  it('should refuse a missing child id', () => {
    const result = parseA2uiMessages(
      components('x', [
        { id: 'root', component: 'Column', children: ['missing'] },
        { id: 't', component: 'Text', text: 'Hi' }
      ])
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('missing')
  })

  it('should accept a table column of share bars', () => {
    const result = parseA2uiMessages(
      components('share', [
        {
          id: 'root',
          component: 'Table',
          columns: [{ label: 'Name' }, { label: 'Share', kind: 'bar' as const }],
          rows: [
            ['Alpha', 45],
            ['Beta', 100]
          ]
        }
      ])
    )
    expect(result.ok).toBe(true)
  })

  it('should refuse a bar column that is not a percentage', () => {
    const result = parseA2uiMessages(
      components('share', [
        {
          id: 'root',
          component: 'Table',
          columns: [{ label: 'Share', kind: 'bar' as const }],
          rows: [['x']]
        }
      ])
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain('root')
      expect(result.reason).toContain('Share')
      expect(result.reason).toContain('0 to 100')
    }
  })

  it('should refuse labels and values of different lengths', () => {
    const result = parseA2uiMessages(
      components('x', [
        {
          id: 'root',
          component: 'Chart',
          kind: 'bar',
          labels: ['a', 'b'],
          series: [{ name: 'S', values: [1] }]
        }
      ])
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('root')
  })
})
