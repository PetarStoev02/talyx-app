import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import {
  CANONICAL_RPC_METHODS,
  GATEWAY_EVENT_TYPES,
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
const EVENT_TYPES = new Set<string>(GATEWAY_EVENT_TYPES)
const REST_PATH = /^\/api\b/

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name).slice(FEATURES.length + 1))
}

/**
 * The engine names a source passes as values: string and template literals that are an engine
 * method or start with a REST path. Comments are not code, and an event type compared with
 * `===` / `!==` or under `case` is the engine's event the feature reads, not a call. A method name
 * that is also an event type (`session.info`) counts only where it is not compared.
 */
function engineTermsInSource(source: string, fileName = 'source.ts'): string[] {
  // The name's extension picks the parser: a .tsx file read as .ts hides what follows its JSX.
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true)
  const terms: string[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node)) {
      const text = node.text
      if (REST_PATH.test(text)) terms.push(text)
      else if (ENGINE_METHODS.has(text) && !(EVENT_TYPES.has(text) && isComparison(node)))
        terms.push(text)
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return terms
}

function isComparison(node: ts.Node): boolean {
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
  return engineTermsInSource(readFileSync(join(FEATURES, file), 'utf8'), file)
}

describe('feature backends', () => {
  const files = sourceFiles(FEATURES)

  it('should name no engine method or REST path in a feature', () => {
    const hits = files.flatMap((file) => engineTermsIn(file).map((term) => `${file}: ${term}`))
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
      ['a REST path in a template', 'http({ path: `/api/sessions/${id}` })'],
      ['a method name compared', "if (method === 'profiles.create') return"],
      ['a method name in a case', "switch (method) { case 'session.create': break }"]
    ])('should find %s', (_name, source) => {
      expect(engineTermsInSource(source)).toHaveLength(1)
    })

    it('should find a REST path after JSX in a component file', () => {
      const source = "const el = <div/>; http({ path: '/api/audio/transcribe' })"
      expect(engineTermsInSource(source, 'Pane.tsx')).toEqual(['/api/audio/transcribe'])
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
