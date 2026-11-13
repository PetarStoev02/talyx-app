import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import {
  CANONICAL_RPC_METHODS,
  RPC_METHODS,
  SERVER_REQUEST_METHODS
} from '../../src/renderer/src/shared/engine/gateway-contract.generated'

// Features speak Talyx's terms; the engine's method names and REST paths live in the wiring under
// app/engine/ (issue #67). An engine method passed as a value, or a REST path in a string.
const FEATURES = 'src/renderer/src/features'
const ENGINE_METHODS = new Set<string>([
  ...RPC_METHODS,
  ...CANONICAL_RPC_METHODS,
  ...SERVER_REQUEST_METHODS
])
// An argument, property or assignment: an event type compared with `===` or under `case` is not a call.
const METHOD_LITERAL = /(?:[(,:]|(?<![=!<>])=)\s*['"`]([a-z_]+(?:\.[a-z_]+)+)['"`]/g
const REST_PATH = /['"`]\/api\//

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

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name).slice(FEATURES.length + 1))
}

function engineTermsIn(file: string): string[] {
  const source = readFileSync(join(FEATURES, file), 'utf8')
  const methods = [...source.matchAll(METHOD_LITERAL)]
    .map((match) => match[1])
    .filter((name) => ENGINE_METHODS.has(name))
  return REST_PATH.test(source) ? [...methods, 'a REST path'] : methods
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
})
