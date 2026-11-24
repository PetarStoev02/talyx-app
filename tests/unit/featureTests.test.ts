import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

// A feature built as use cases over a backend (`<feature>Actions(backend)`, the one feature shape) keeps
// its tests in tests/unit/<feature>/, beside the others (issue #184, S9).
const FEATURES = 'src/renderer/src/features'
const TESTS = 'tests/unit'
const ACTIONS =
  /^export (?:(?:async )?function [a-z]\w*Actions\s*[(<]|const [a-z]\w*Actions\s*[:=])/m

function featuresWithActions(): string[] {
  return readdirSync(FEATURES, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((feature) =>
      readdirSync(join(FEATURES, feature), { withFileTypes: true, recursive: true }).some(
        (entry) =>
          entry.isFile() &&
          /\.tsx?$/.test(entry.name) &&
          ACTIONS.test(readFileSync(join(entry.parentPath, entry.name), 'utf8'))
      )
    )
}

function hasTests(feature: string): boolean {
  const folder = join(TESTS, feature)
  return existsSync(folder) && readdirSync(folder).some((name) => name.endsWith('.test.ts'))
}

describe('feature tests', () => {
  const features = featuresWithActions()

  it('should find the features built as actions over a backend', () => {
    expect(features).toEqual(expect.arrayContaining(['bots', 'chat']))
  })

  it('should give every feature with actions a test folder of its own', () => {
    expect(features.filter((feature) => !hasTests(feature))).toEqual([])
  })

  describe('actions in a source', () => {
    it.each([
      ['a function', 'export function chatActions(backend: ChatBackend): ChatActions {'],
      ['an async function', 'export async function roomActions(backend: RoomBackend) {'],
      ['an arrow function', 'export const rosterActions = (backend: RosterWriter) => ({'],
      ['a generic function', 'export function chatActions<T>(backend: T): ChatActions {'],
      ['a typed constant', 'export const roomActions: (backend: RoomBackend) => RoomActions ='],
      ['one export among others', "import x from 'y'\n\nexport function chatActions(backend) {"]
    ])('should find %s', (_name, source) => {
      expect(ACTIONS.test(source)).toBe(true)
    })

    it.each([
      ['the actions type', 'export interface ChatActions {'],
      ['a function kept inside the file', 'function chatActions(backend: ChatBackend) {'],
      ['a type alias named like actions', 'export type chatActions = ReturnType<typeof make>'],
      ['a constant named like a type', 'export const ChatActions = {']
    ])('should ignore %s', (_name, source) => {
      expect(ACTIONS.test(source)).toBe(false)
    })
  })
})
