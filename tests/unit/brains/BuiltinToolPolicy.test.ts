import { describe, it, expect } from 'vitest'
import {
  builtinToolClass,
  describeBuiltinCall,
  DENIED_BUILTINS
} from '../../../src/main/domain/agent/BuiltinToolPolicy'

describe('builtinToolClass', () => {
  it.each([
    ['Read', 'auto'],
    ['Glob', 'auto'],
    ['Grep', 'auto'],
    ['LS', 'auto'],
    ['WebSearch', 'ask'],
    ['WebFetch', 'ask'],
    ['TodoWrite', 'auto'],
    ['mcp__talyx__list_repos', 'auto'],
    ['Bash', 'ask'],
    ['Edit', 'ask'],
    ['MultiEdit', 'ask'],
    ['Write', 'ask'],
    ['NotebookEdit', 'ask'],
    ['SomeFutureTool', 'ask'],
    ['mcp__other__thing', 'ask'],
    ['Task', 'deny'],
    ['KillShell', 'deny']
  ] as const)('should classify %s as %s', (name, expected) => {
    expect(builtinToolClass(name)).toBe(expected)
  })

  it('should list exactly the denied tools for the SDK', () => {
    expect([...DENIED_BUILTINS]).toEqual(['Task', 'KillShell'])
  })
})

describe('describeBuiltinCall', () => {
  it('should show a Bash command as a shell line', () => {
    const card = describeBuiltinCall({ id: 't1', name: 'Bash', input: { command: 'npm test' } })
    expect(card).toEqual({
      id: 't1',
      tool: 'Bash',
      summary: 'Run a command',
      reversible: false,
      operations: [{ label: '$ npm test', reason: '' }]
    })
  })

  it('should add the working directory when Bash has one', () => {
    const card = describeBuiltinCall({
      id: 't1',
      name: 'Bash',
      input: { command: 'ls', cwd: '/Users/p/Code/talyx' }
    })
    expect(card.operations.map((o) => o.label)).toEqual(['$ ls', 'in /Users/p/Code/talyx'])
  })

  it('should show the path and at most three removed and three added lines for Edit', () => {
    const card = describeBuiltinCall({
      id: 't2',
      name: 'Edit',
      input: {
        file_path: '/r/README.md',
        old_string: 'a\nb\nc\nd',
        new_string: 'A\nB'
      }
    })
    expect(card.summary).toBe('Edit file')
    expect(card.operations.map((o) => o.label)).toEqual([
      '/r/README.md',
      '- a',
      '- b',
      '- c',
      '+ A',
      '+ B'
    ])
  })

  it('should describe MultiEdit from its first edit', () => {
    const card = describeBuiltinCall({
      id: 't3',
      name: 'MultiEdit',
      input: {
        file_path: '/r/x.ts',
        edits: [
          { old_string: 'one', new_string: 'uno' },
          { old_string: 'two', new_string: 'dos' }
        ]
      }
    })
    expect(card.operations.map((o) => o.label)).toEqual(['/r/x.ts', '- one', '+ uno'])
  })

  it('should show the path and the byte count for Write', () => {
    const card = describeBuiltinCall({
      id: 't4',
      name: 'Write',
      input: { file_path: '/r/new.txt', content: 'héllo' }
    })
    expect(card.summary).toBe('Write file')
    expect(card.operations.map((o) => o.label)).toEqual(['/r/new.txt', '6 bytes'])
  })

  it('should show the notebook path and cell for NotebookEdit', () => {
    const card = describeBuiltinCall({
      id: 't5',
      name: 'NotebookEdit',
      input: { notebook_path: '/r/n.ipynb', cell_id: 'c9', new_source: 'x' }
    })
    expect(card.operations.map((o) => o.label)).toEqual(['/r/n.ipynb', 'cell c9'])
  })

  it('should fall back to the tool name and truncated JSON for unknown tools', () => {
    const card = describeBuiltinCall({
      id: 't6',
      name: 'Mystery',
      input: { big: 'x'.repeat(500) }
    })
    expect(card.summary).toBe('Claude Code: Mystery')
    expect(card.operations).toHaveLength(1)
    expect(card.operations[0].label).toHaveLength(201)
    expect(card.operations[0].label.endsWith('…')).toBe(true)
  })
})
