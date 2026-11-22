import { describe, expect, it } from 'vitest'
import {
  MCP_UI_CATALOG,
  gateShowUiMessages,
  isShowUiToolName,
  parseA2uiMessages,
  parseA2uiSurface
} from '../../src/shared/a2uiSurface'

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

  it('should refuse when a message has no version 1.0', () => {
    const bad = [
      { version: '2.0', createSurface: { surfaceId: 'x', catalogId: MCP_UI_CATALOG } },
      { version: '1.0', updateComponents: { surfaceId: 'x', components: [] } }
    ]
    expect(gateShowUiMessages(bad)).toContain('1.0')
    expect(parseA2uiMessages(bad as never).ok).toBe(false)
  })

  it('should refuse duplicate component ids', () => {
    const result = parseA2uiMessages(
      components('x', [
        { id: 'root', component: 'Column', children: ['a'] },
        { id: 'a', component: 'Text', text: 'Hi' },
        { id: 'a', component: 'Divider' }
      ])
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('Two components share')
  })

  it('should refuse a column that names the same child twice', () => {
    const result = parseA2uiMessages(
      components('x', [
        { id: 'root', component: 'Column', children: ['a', 'a'] },
        { id: 'a', component: 'Text', text: 'Hi' }
      ])
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('same child twice')
  })

  it('should refuse a button whose child is not text', () => {
    const result = parseA2uiMessages(
      components('x', [
        { id: 'root', component: 'Column', children: ['btn'] },
        { id: 'btn', component: 'Button', child: 'root', action: { event: { name: 'go' } } }
      ])
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('Button')
    if (!result.ok) expect(result.reason).toContain('Text')
  })

  it('should refuse a pie chart with more than one series', () => {
    const result = parseA2uiMessages(
      components('x', [
        {
          id: 'root',
          component: 'Chart',
          kind: 'pie',
          labels: ['A'],
          series: [
            { name: 'One', values: [1] },
            { name: 'Two', values: [1] }
          ]
        }
      ])
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('one series')
  })

  it('should refuse a table row with the wrong column count', () => {
    const result = parseA2uiMessages(
      components('x', [
        {
          id: 'root',
          component: 'Table',
          columns: [{ label: 'A' }, { label: 'B' }],
          rows: [['only one']]
        }
      ])
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('2 columns')
  })

  it('should refuse chart values above the cap', () => {
    const result = parseA2uiMessages(
      components('x', [
        {
          id: 'root',
          component: 'Chart',
          kind: 'bar',
          labels: ['A'],
          series: [{ name: 'S', values: [1e12 + 1] }]
        }
      ])
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('1000000000000')
  })

  it('should count UTF-8 bytes for the size limit', () => {
    const huge = '…'.repeat(20_000)
    const result = parseA2uiMessages(
      components('x', [
        { id: 'root', component: 'Column', children: ['t'] },
        { id: 't', component: 'Text', text: huge }
      ])
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('bytes')
  })

  it('should refuse a forbidden data model key', () => {
    const result = parseA2uiMessages([
      ...components('x', [
        { id: 'root', component: 'Column', children: ['f'] },
        { id: 'f', component: 'TextField', label: 'Name', value: { '@path': '/__proto__' } }
      ]),
      {
        version: '1.0',
        updateDataModel: { surfaceId: 'x', value: { __proto__: 'x' } }
      }
    ])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('__proto__')
  })

  it('should refuse two inputs with the same label', () => {
    const result = parseA2uiMessages(
      components('x', [
        { id: 'root', component: 'Column', children: ['a', 'b'] },
        { id: 'a', component: 'TextField', label: 'Name', value: { '@path': '/a' } },
        { id: 'b', component: 'TextField', label: 'Name', value: { '@path': '/b' } }
      ])
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('Two inputs share')
  })

  it('should refuse two options of one choice with the same value', () => {
    const result = parseA2uiMessages(
      components('x', [
        {
          id: 'root',
          component: 'ChoicePicker',
          options: [
            { label: 'A', value: 'x' },
            { label: 'B', value: 'x' }
          ],
          value: { '@path': '/pick' }
        }
      ])
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toContain('two options share the value "x"')
  })

  it('should match only Talyx show_ui tool names', () => {
    expect(isShowUiToolName('show_ui')).toBe(true)
    expect(isShowUiToolName('mcp__talyx__show_ui')).toBe(true)
    expect(isShowUiToolName('mcp__other__show_ui')).toBe(false)
    expect(isShowUiToolName('mcp__talyx__other')).toBe(false)
  })

  it('should parse tool args through the same gate as stored messages', () => {
    const payload = components('x', [
      { id: 'root', component: 'Column', children: ['t'] },
      { id: 't', component: 'Text', text: 'Hi' }
    ])
    expect(parseA2uiSurface({ messages: payload }).ok).toBe(true)
    expect(parseA2uiSurface({ messages: [{ version: '9' }] }).ok).toBe(false)
  })
})
