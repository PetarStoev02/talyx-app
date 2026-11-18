import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { BLOCK_SHAPES } from '../../src/shared/moduleHost'

const SRC = 'src'
const I18N = join(SRC, 'renderer/src/shared/lib/i18n.ts')

// Keys a source builds at runtime: the exact call, the map whose callback holds it, and the keys
// that map's typed list gives. LookPicker labels each shape this way. A new family goes here, or its
// keys read as unused.
const FAMILIES = [
  {
    call: 't(`look.shape.${shape}`)',
    map: 'BLOCK_SHAPES.map((shape) =>',
    keys: BLOCK_SHAPES.map((shape) => `look.shape.${shape}`)
  }
]

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
 * keys a declared family's call builds. Comments are not code, and a key compared or named in a
 * type is read, not shown.
 */
function keysUsedIn(source: string, fileName = 'source.tsx'): string[] {
  const used = new Set<string>()
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteralLike(node) && !isComparedOrTyped(node)) used.add(node.text)
    else if (ts.isCallExpression(node)) familyKeys(node).forEach((key) => used.add(key))
    ts.forEachChild(node, visit)
  }
  visit(parse(fileName, source))
  return KEYS.filter((key) => used.has(key))
}

function isComparedOrTyped(node: ts.Node): boolean {
  const parent = node.parent
  if (ts.isCaseClause(parent) || ts.isLiteralTypeNode(parent)) return true
  if (!ts.isBinaryExpression(parent)) return false
  const operator = parent.operatorToken.kind
  return (
    operator === ts.SyntaxKind.EqualsEqualsEqualsToken ||
    operator === ts.SyntaxKind.ExclamationEqualsEqualsToken
  )
}

/** A declared family's keys, when this is its call in a callback of its map. */
function familyKeys(call: ts.CallExpression): string[] {
  const family = FAMILIES.find((candidate) => candidate.call === call.getText())
  const map = ts.findAncestor(call, ts.isFunctionLike)?.parent
  return family && map?.getText().startsWith(family.map) ? family.keys : []
}

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
    expect(
      KEYS.filter((key) => !used.has(key)),
      'Delete each key from i18n.ts, or declare the call that builds it at runtime in FAMILIES'
    ).toEqual([])
  })

  describe('keys a source uses', () => {
    it.each([
      ['a t call', "t('nav.agents')", ['nav.agents']],
      ['a table value', "const KIND = { bot: 'roster.kindBot' }", ['roster.kindBot']],
      ['an error key', "throw new RosterError('roster.errorConflict')", ['roster.errorConflict']],
      [
        'a declared family in its map',
        'BLOCK_SHAPES.map((shape) => <b title={t(`look.shape.${shape}`)} />)',
        BLOCK_SHAPES.map((shape) => `look.shape.${shape}`)
      ]
    ])('should find %s', (_name, source, keys) => {
      expect(keysUsedIn(source)).toEqual(keys)
    })

    it.each([
      ['a key in a comment', "// t('nav.agents')\nconst x = 1"],
      ['a key only compared', "if (problem.key === 'nav.agents') show()"],
      ['a key only in a case', "switch (key) { case 'nav.agents': break }"],
      ['a key only named in a type', "type Page = 'nav.agents'"],
      ['a template with no declared family', 't(`nav.${page}`)'],
      ['a family call outside its map', 't(`look.shape.${shape}`)'],
      [
        'a family call over another list',
        "(['cube'] as const).map((shape) => t(`look.shape.${shape}`))"
      ],
      ['a family template outside a t call', 'BLOCK_SHAPES.map((shape) => `look.shape.${shape}`)'],
      ['a family call over one shape', "BLOCK_SHAPES.map((shape) => t(`look.shape.${'cube'}`))"]
    ])('should ignore %s', (_name, source) => {
      expect(keysUsedIn(source)).toEqual([])
    })
  })
})
