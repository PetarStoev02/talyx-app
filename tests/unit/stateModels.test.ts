import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { unionMembers } from './stateChart'

const MODELS = 'docs/state/models'
const GATEWAY = 'src/renderer/src/shared/engine/json-rpc-gateway.ts'
const UPDATE_STATE = 'src/main/infrastructure/updater/updateState.ts'

const sorted = (values: Iterable<string>): string[] => [...new Set(values)].sort()
const read = (file: string): string => readFileSync(join(__dirname, '../..', file), 'utf8')

interface Model {
  name: string
  /** A set the model declares, the TypeScript union it stands for, and where the model uses it. */
  sets: Array<{
    set: string
    file: string
    union: string
    discriminant: string | null
    uses: RegExp
  }>
}

/** The TLA+ models in docs/state/models, against the unions of the code they model. */
const MODELS_UNDER_TEST: Model[] = [
  {
    name: 'EngineConnection',
    sets: [
      {
        set: 'States',
        file: GATEWAY,
        union: 'ConnectionState',
        discriminant: null,
        uses: /(?:st'? = |Lose\()"([a-z]+)"/g
      }
    ]
  },
  {
    name: 'UpdateFlow',
    sets: [
      {
        set: 'States',
        file: 'src/shared/updater.ts',
        union: 'UpdateState',
        discriminant: 'kind',
        uses: /(?:kind'? = |<<)"([a-z]+)"/g
      },
      {
        set: 'Events',
        file: UPDATE_STATE,
        union: 'UpdateEvent',
        discriminant: 'kind',
        uses: /(?:event' = |Apply\()"([a-z]+)"/g
      }
    ]
  }
]

describe('TLA+ models in docs/state/models', () => {
  describe.each(MODELS_UNDER_TEST)('$name', ({ name, sets }) => {
    const spec = read(`${MODELS}/${name}.tla`)
    const invariants = invariantsOf(read(`${MODELS}/${name}.cfg`))

    it.each(sets)('should declare $set as the members of $union', (each) => {
      expect(sorted(declaredSet(spec, each.set))).toEqual(
        sorted(unionMembers(each.file, each.union, each.discriminant))
      )
    })

    it.each(sets)('should move only between the members of $set, and use each', (each) => {
      expect(sorted(usedLiterals(spec, each.uses))).toEqual(sorted(declaredSet(spec, each.set)))
    })

    it('should have TLC check that every state stays inside the declared sets', () => {
      expect(invariants).toContain('TypeOK')
      const typeOk = definitionOf(spec, 'TypeOK')
      for (const { set } of sets) expect(typeOk).toMatch(new RegExp(`\\\\in ${set}\\b`))
    })

    it('should record in the README every property TLC checks', () => {
      const readme = read(`${MODELS}/README.md`)
      for (const invariant of invariants) expect(readme).toContain(`\`${invariant}\``)
    })
  })
})

function declaredSet(spec: string, name: string): string[] {
  const body = definitionOf(spec, name).match(/^\{(.*)\}$/s)?.[1]
  if (body === undefined) throw new Error(`${name} is not a set literal`)
  return [...body.matchAll(/"([^"]+)"/g)].map((match) => match[1])
}

/** The literals a pattern finds outside the declarations, so the model's steps, not its sets. */
function usedLiterals(spec: string, pattern: RegExp): string[] {
  const steps = spec.replace(/^(States|Events) == .*$/gm, '')
  return [...steps.matchAll(pattern)].map((match) => match[1])
}

/** The right-hand side of `name == ...`, up to the next blank line or definition. */
function definitionOf(spec: string, name: string): string {
  const match = spec.match(
    new RegExp(`^${name} ==([\\s\\S]*?)(?=\\n\\s*\\n|\\n\\S+ ==|\\n\\\\\\*)`, 'm')
  )
  if (!match) throw new Error(`the model has no ${name}`)
  return match[1].trim()
}

function invariantsOf(config: string): string[] {
  return config
    .split('\n')
    .filter((line) => line.startsWith('INVARIANT'))
    .flatMap((line) => line.split(/\s+/).slice(1))
}
