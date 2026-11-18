import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import ts from 'typescript'
import { expect } from 'vitest'

const ROOT = join(__dirname, '../..')
const REGENERATE = 'UPDATE_STATE_CHARTS=1 npx vitest run tests/unit/stateCharts.test.ts'

/** One run of a machine: a state, an event, and where the code took it. */
export interface Run {
  from: string
  event: string
  /** Where the event left the machine; null when it changed nothing. */
  to: string | null
  /** States the code passed through on the way to `to`, in order. */
  via: string[]
  /** The case, one value per dimension (a release that downloads, a fact that is done). */
  when: Record<string, string>
}

/**
 * The members of the union type `name` in `file`, read from the source: each string literal, or
 * for a union of objects each member's `discriminant`. The tests are not typechecked, so this is
 * what makes a new member fail the chart test instead of being left off the chart.
 */
export function unionMembers(file: string, name: string, discriminant: string | null): string[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(join(ROOT, file), 'utf8'),
    ts.ScriptTarget.Latest
  )
  const alias = source.statements.find(
    (node): node is ts.TypeAliasDeclaration =>
      ts.isTypeAliasDeclaration(node) && node.name.text === name
  )
  if (!alias || !ts.isUnionTypeNode(alias.type)) throw new Error(`${file} has no union ${name}`)
  return alias.type.types.map((member) => {
    const literal = discriminant ? discriminantOf(member, discriminant) : member
    if (literal && ts.isLiteralTypeNode(literal) && ts.isStringLiteral(literal.literal))
      return literal.literal.text
    throw new Error(`${name} in ${file} has a member this test cannot read`)
  })
}

function discriminantOf(member: ts.TypeNode, name: string): ts.TypeNode | undefined {
  if (!ts.isTypeLiteralNode(member)) return undefined
  const property = member.members.find(
    (node): node is ts.PropertySignature =>
      ts.isPropertySignature(node) && ts.isIdentifier(node.name) && node.name.text === name
  )
  return property?.type
}

/**
 * A Mermaid state diagram of `runs`: one edge per state, event and outcome. A label names the
 * cases an edge takes only when not every case of its state does.
 */
export function stateDiagram(runs: Run[], start: string | null): string {
  const lines = ['stateDiagram-v2', ...(start ? [`  [*] --> ${start}`] : [])]
  for (const group of groupBy(runs, (run) => [run.from, run.event])) {
    const cases = runs.filter((run) => run.from === group[0].from)
    const moved = group.filter((run) => run.to !== null)
    for (const edge of groupBy(moved, (run) => [run.to, ...run.via])) {
      const label = labelOf(edge, group, cases)
      lines.push(`  ${edge[0].from} --> ${edge[0].to}${label ? ` : ${label}` : ''}`)
    }
  }
  return lines.join('\n')
}

function labelOf(edge: Run[], group: Run[], cases: Run[]): string {
  const valuesOf = (runs: Run[], dimension: string): string[] => [
    ...new Set(runs.filter((run) => dimension in run.when).map((run) => run.when[dimension]))
  ]
  const picked = Object.keys(edge[0].when)
    .map((dimension) => ({ dimension, values: valuesOf(edge, dimension) }))
    .filter(({ dimension, values }) => values.length < valuesOf(cases, dimension).length)
  const taken = group.filter((run) =>
    picked.every(({ dimension, values }) => values.includes(run.when[dimension]))
  )
  // A label must pick out exactly the runs that take the edge, or the chart would mislead.
  if (taken.length !== edge.length)
    throw new Error(`No label picks out ${edge[0].from} --> ${edge[0].to} on "${edge[0].event}"`)
  const when = picked.map(({ values }) => values.join(' or ')).join(', ')
  const via = edge[0].via.length ? `via ${edge[0].via.join(', ')}` : ''
  const event = edge[0].event && when ? `${edge[0].event} (${when})` : edge[0].event || when
  return [event, via].filter(Boolean).join(' ')
}

function groupBy(runs: Run[], key: (run: Run) => Array<string | null>): Run[][] {
  const groups = new Map<string, Run[]>()
  for (const run of runs) {
    const id = JSON.stringify(key(run))
    groups.set(id, [...(groups.get(id) ?? []), run])
  }
  return [...groups.values()]
}

export interface ChartPage {
  title: string
  /** The code the chart is drawn from. */
  sources: string[]
  diagram: string
  /** Lines under the chart, built from the code's own constants. */
  notes: string[]
}

/**
 * Fails when `docs/state/<name>.md` is not `page` and says how to regenerate it; writes it instead
 * when UPDATE_STATE_CHARTS=1.
 */
export function expectCommittedChart(name: string, page: ChartPage): void {
  const file = `docs/state/${name}.md`
  const text = [
    `# ${page.title}`,
    `Drawn from ${page.sources.map((source) => `\`${source}\``).join(' and ')} by \`tests/unit/stateCharts.test.ts\`, which fails when this file is stale. Do not edit it by hand; regenerate it with \`${REGENERATE}\`.`,
    'An edge is labelled with its event, then in brackets the cases that take it when not every case of its state does. `via` names a state the code passes through on the way.',
    `\`\`\`mermaid\n${page.diagram}\n\`\`\``,
    ...page.notes
  ].join('\n\n')
  const path = join(ROOT, file)
  if (process.env.UPDATE_STATE_CHARTS === '1') {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, `${text}\n`)
    return
  }
  const committed = existsSync(path) ? readFileSync(path, 'utf8') : null
  expect(committed, `${file} is stale. Regenerate it: ${REGENERATE}`).toBe(`${text}\n`)
}
