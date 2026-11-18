import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { BLOCK_SHAPES } from '../../src/shared/moduleHost'

const SRC = 'src'
const I18N = join(SRC, 'renderer/src/shared/lib/i18n.ts')

// Keys a source builds at runtime, by template head, with the typed list its one placeholder takes:
// LookPicker labels each shape with t(`look.shape.${shape}`) over BLOCK_SHAPES. A new family goes
// here with its list, or its keys read as unused.
const FAMILIES = new Map<string, readonly string[]>([['look.shape.', BLOCK_SHAPES]])

const parse = (path: string, source: string): ts.SourceFile =>
  ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)

/** The English table's keys, from its object literal, so no spelling of a key is missed. */
function tableKeys(): string[] {
  const table = parse(I18N, readFileSync(I18N, 'utf8'))
    .statements.filter(ts.isVariableStatement)
    .flatMap((statement) => statement.declarationList.declarations)
    .find((declaration) => declaration.name.getText() === 'en')?.initializer
  if (!table || !ts.isObjectLiteralExpression(table)) throw new Error(`No en table in ${I18N}`)
  return table.properties.map((property) => {
    if (!ts.isPropertyAssignment(property)) throw new Error(`Not a key: ${property.getText()}`)
    return ts.isStringLiteral(property.name) ? property.name.text : property.name.getText()
  })
}

const KEYS = tableKeys()

/**
 * The keys a source uses: string literals (a `t` call, a table value, an error's key) and the
 * family a `head${value}` template builds. Comments are not code.
 */
function keysUsedIn(source: string, fileName = 'source.tsx'): string[] {
  const used = new Set<string>()
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteralLike(node)) used.add(node.text)
    else if (ts.isTemplateExpression(node) && isHeadAndValue(node))
      for (const value of FAMILIES.get(node.head.text) ?? []) used.add(node.head.text + value)
    ts.forEachChild(node, visit)
  }
  visit(parse(fileName, source))
  return KEYS.filter((key) => used.has(key))
}

// `head${value}` and nothing more: one placeholder, no text after it.
const isHeadAndValue = (node: ts.TemplateExpression): boolean =>
  node.templateSpans.length === 1 && node.templateSpans[0]?.literal.text === ''

function sourceFiles(): string[] {
  return readdirSync(SRC, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((path) => path !== I18N)
}

describe('i18n keys', () => {
  it('should use every key of the English table somewhere in src', () => {
    const used = new Set(
      sourceFiles().flatMap((path) => keysUsedIn(readFileSync(path, 'utf8'), path))
    )

    expect(KEYS).not.toHaveLength(0)
    expect(KEYS.filter((key) => !used.has(key))).toEqual([])
  })

  describe('keys a source uses', () => {
    it.each([
      ['a t call', "t('nav.agents')", ['nav.agents']],
      ['a table value', "const KIND = { bot: 'roster.kindBot' }", ['roster.kindBot']],
      ['an error key', "throw new RosterError('roster.errorConflict')", ['roster.errorConflict']],
      [
        'a template over a declared family',
        't(`look.shape.${shape}`)',
        BLOCK_SHAPES.map((shape) => `look.shape.${shape}`)
      ]
    ])('should find %s', (_name, source, keys) => {
      expect(keysUsedIn(source)).toEqual(keys)
    })

    it.each([
      ['a key in a comment', "// t('nav.agents')\nconst x = 1"],
      ['a template with no declared family', 't(`nav.${page}`)'],
      ['a family template with text after the placeholder', 't(`look.shape.${shape}.alt`)'],
      ['a family template with two placeholders', 't(`look.shape.${shape}${size}`)']
    ])('should ignore %s', (_name, source) => {
      expect(keysUsedIn(source)).toEqual([])
    })
  })
})
