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
  /**
   * A set the model declares, the TypeScript union it stands for, the variable that holds its
   * members, and where else the model writes them.
   */
  sets: Array<{
    set: string
    file: string
    union: string
    discriminant: string | null
    variable: string
    elsewhere: RegExp
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
        variable: 'st',
        elsewhere: /Lose\("([a-z]+)"\)/g
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
        variable: 'kind',
        elsewhere: /(?:<<|to\[1\] = )"([a-z]+)"/g
      },
      {
        set: 'Events',
        file: UPDATE_STATE,
        union: 'UpdateEvent',
        discriminant: 'kind',
        variable: 'event',
        elsewhere: /Apply\("([a-z]+)"/g
      }
    ]
  },
  { name: 'RoomPolling', sets: [] }
]

describe('TLA+ models in docs/state/models', () => {
  describe.each(MODELS_UNDER_TEST)('$name', ({ name, sets }) => {
    const spec = read(`${MODELS}/${name}.tla`)
    const properties = propertiesOf(read(`${MODELS}/${name}.cfg`))

    it.each(sets)('should declare $set as the members of $union', (each) => {
      expect(sorted(declaredSet(spec, each.set))).toEqual(
        sorted(unionMembers(each.file, each.union, each.discriminant))
      )
    })

    // A guard or property that names a state outside the set is silently false under TLC.
    it.each(sets)('should name only the members of $set, and each of them', (each) => {
      expect(sorted(usedLiterals(spec, each.variable, each.elsewhere))).toEqual(
        sorted(declaredSet(spec, each.set))
      )
    })

    it('should have TLC check that every state stays inside the declared sets', () => {
      expect(properties).toContain('TypeOK')
      const typeOk = definitionOf(spec, 'TypeOK')
      expect(typeOk).not.toContain('\\/')
      for (const { set, variable } of sets)
        expect(typeOk).toMatch(new RegExp(`\\b${variable} \\\\in ${set}\\b`))
    })

    it('should record in the README every property TLC checks', () => {
      const readme = read(`${MODELS}/README.md`)
      for (const property of properties) expect(readme).toContain(`\`${property}\``)
    })
  })
})

function declaredSet(spec: string, name: string): string[] {
  const body = definitionOf(spec, name).match(/^\{(.*)\}$/s)?.[1]
  if (body === undefined) throw new Error(`${name} is not a set literal`)
  return [...body.matchAll(/"([^"]+)"/g)].map((match) => match[1])
}

/**
 * The literals the model compares `variable` with or assigns it (`=`, `#`, `\in {...}`), and those
 * `elsewhere` finds: its steps, guards and properties, not its declarations.
 */
function usedLiterals(spec: string, variable: string, elsewhere: RegExp): string[] {
  const steps = spec.replace(/^(States|Events) == .*$/gm, '')
  const literals = (text: string): string[] =>
    [...text.matchAll(/"([a-z]+)"/g)].map((match) => match[1])
  const compared = new RegExp(`\\b${variable}'?\\s*(?:=|#)\\s*("[a-z]+")`, 'g')
  const member = new RegExp(`\\b${variable}'?\\s*\\\\in\\s*\\{([^}]*)\\}`, 'g')
  return [
    ...[...steps.matchAll(compared), ...steps.matchAll(member)].flatMap((match) =>
      literals(match[1])
    ),
    ...[...steps.matchAll(elsewhere)].map((match) => match[1])
  ]
}

/** The right-hand side of `name == ...`, up to the next blank line or definition. */
function definitionOf(spec: string, name: string): string {
  const match = spec.match(
    new RegExp(`^${name} ==([\\s\\S]*?)(?=\\n\\s*\\n|\\n\\S+ ==|\\n\\\\\\*)`, 'm')
  )
  if (!match) throw new Error(`the model has no ${name}`)
  return match[1].trim()
}

/** Every invariant and temporal property a config has TLC check. */
function propertiesOf(config: string): string[] {
  return config
    .split('\n')
    .filter((line) => /^(INVARIANTS?|PROPERT(Y|IES))\b/.test(line))
    .flatMap((line) => line.split(/\s+/).slice(1))
}
