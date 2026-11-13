import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import {
  CANONICAL_RPC_METHODS,
  RPC_METHODS,
  SERVER_REQUEST_METHODS
} from '../../src/renderer/src/shared/engine/gateway-contract.generated'

// Features speak Talyx's terms; the engine's method names and REST paths live in the wiring under
// app/engine/ (issue #67).
const FEATURES = 'src/renderer/src/features'
// Dotted names only: one-word methods (`ping`, `approval`) are also ordinary Talyx words.
const ENGINE_METHODS = new Set<string>(
  [...RPC_METHODS, ...CANONICAL_RPC_METHODS, ...SERVER_REQUEST_METHODS].filter((name) =>
    name.includes('.')
  )
)
const REST_PATH = /^\/api\b/

// Files not moved to the wiring yet. Each PR of #67 takes its files off; the last empties it.
const NOT_YET_MOVED = new Set([
  'bots/actions.ts',
  'bots/bulk.ts',
  'bots/create.ts',
  'bots/data.ts',
  'bots/details.ts',
  'bots/look.ts',
  'bots/mcp.ts',
  'bots/mcpRegistration.ts',
  'bots/rooms.ts',
  'bots/routines.ts',
  'bots/rules.ts',
  'chat/chat.ts',
  'chat/room.ts',
  'providers/providers.ts'
])
// Calls already moved out of a file that is still on the list above: they must not come back.
const MOVED_CALLS = ['/api/audio/transcribe']

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name).slice(FEATURES.length + 1))
}

/**
 * The engine names a source passes as values: string and template literals that are an engine
 * method or start with a REST path. Comments are not code, and an event type compared with
 * `===` / `!==` or under `case` is the engine's event, not a call.
 */
export function engineTermsInSource(source: string): string[] {
  const file = ts.createSourceFile('source.ts', source, ts.ScriptTarget.Latest, true)
  const terms: string[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node)) {
      const text = node.text
      if (REST_PATH.test(text)) terms.push(text)
      else if (ENGINE_METHODS.has(text) && !isEventComparison(node)) terms.push(text)
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return terms
}

function isEventComparison(node: ts.Node): boolean {
  const parent = node.parent
  if (ts.isCaseClause(parent)) return true
  if (!ts.isBinaryExpression(parent)) return false
  const operator = parent.operatorToken.kind
  return (
    operator === ts.SyntaxKind.EqualsEqualsEqualsToken ||
    operator === ts.SyntaxKind.ExclamationEqualsEqualsToken
  )
}

function engineTermsIn(file: string): string[] {
  return engineTermsInSource(readFileSync(join(FEATURES, file), 'utf8'))
}

describe('feature backends', () => {
  const files = sourceFiles(FEATURES)

  it('should name no engine method or REST path in a moved feature', () => {
    const hits = files
      .filter((file) => !NOT_YET_MOVED.has(file))
      .flatMap((file) => engineTermsIn(file).map((term) => `${file}: ${term}`))
    expect(hits).toEqual([])
  })

  it('should list only files that still name the engine as not yet moved', () => {
    const moved = [...NOT_YET_MOVED].filter((file) => engineTermsIn(file).length === 0)
    expect(moved).toEqual([])
  })

  it('should keep moved calls out of files not yet moved', () => {
    const hits = files.flatMap((file) =>
      engineTermsIn(file)
        .filter((term) => MOVED_CALLS.some((call) => term.startsWith(call)))
        .map((term) => `${file}: ${term}`)
    )
    expect(hits).toEqual([])
  })

  describe('engine terms in a source', () => {
    it.each([
      ['a call argument', "backend.request(profile, 'profiles.create', {})"],
      ['an argument after a comment', "backend.request(profile, /* new */ 'profiles.create', {})"],
      ['an array element', "const methods = ['profiles.create']"],
      ['a return value', "function m(): string { return 'profiles.create' }"],
      ['a ternary branch', "const m = ok ? 'profiles.create' : 'x'"],
      ['a method with digits or capitals', "call('i18n.catalog')"],
      ['a REST path', "http({ path: '/api/env' })"],
      ['a bare REST root', "const root = '/api' + rest"],
      ['a REST path in a template', 'http({ path: `/api/sessions/${id}` })']
    ])('should find %s', (_name, source) => {
      expect(engineTermsInSource(source)).toHaveLength(1)
    })

    it.each([
      ['an event type compared', "if (event.type === 'session.info') return"],
      ['an event type in a case', "switch (type) { case 'session.info': break }"],
      ['a comment', "// calls 'profiles.create'\nconst x = 1"],
      ['an i18n key', "t('providers.saved')"],
      ['an import path', "import { a } from '@shared/api/ipc'"],
      ['a one-word Talyx term', "const kind = 'approval'"]
    ])('should ignore %s', (_name, source) => {
      expect(engineTermsInSource(source)).toEqual([])
    })
  })
})
