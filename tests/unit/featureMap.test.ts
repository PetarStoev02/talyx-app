import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { t, type TranslationKey } from '../../src/renderer/src/shared/lib/i18n'

const FEATURES = join(__dirname, '../../.claude/skills/verify-talyx/features')
const I18N = join(__dirname, '../../src/renderer/src/shared/lib/i18n.ts')

const read = (file: string): string => readFileSync(join(FEATURES, file), 'utf-8')
const recipes = readdirSync(FEATURES).filter((file) => file.endsWith('.md') && file !== 'README.md')
// A flag's quoted values; any other spelling of the flag fails, so none goes unchecked.
function quoted(text: string, flag: string): string[] {
  const values = [...text.matchAll(new RegExp(`${flag} "([^"]+)"`, 'g'))].map((match) => match[1])
  expect(values).toHaveLength(text.match(new RegExp(`${flag}\\b`, 'g'))?.length ?? 0)
  return values
}

// Every English string the app shows; keys read from the table, values from `t` itself.
const copy = [...readFileSync(I18N, 'utf-8').matchAll(/^\s*'([^']+)':/gm)].map(([, key]) =>
  t(key as TranslationKey, 'en')
)

// A bot or room a recipe made is named by what the map typed (`--value`), not by the app's copy;
// one recipe can use what another made (chat-send uses create-bot's scratch bot).
const typed = recipes.flatMap((file) => quoted(read(file), '--value'))

const PLACEHOLDER = /\{\w+\}/
const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// What a `{placeholder}` in an aria-label stands for: a name the map typed, another label, a count.
const filler = `(?:${[...typed, ...copy.filter((value) => !PLACEHOLDER.test(value))]
  .map(escape)
  .join('|')}|\\d+)`
const shapes = copy.map(
  (value) => new RegExp(`^${value.split(PLACEHOLDER).map(escape).join(filler)}$`)
)

describe('verification feature map', () => {
  it.each(recipes)('should name only controls the app labels in %s', (file) => {
    const unknown = quoted(read(file), '--name').filter(
      (name) => !typed.includes(name) && !shapes.some((value) => value.test(name))
    )
    expect(unknown).toEqual([])
  })

  it('should list every feature file, each with the four sections in order', () => {
    const index = read('README.md')
    const contract = index.split('## Feature entry contract')[1].split('\n## ')[0]
    const sections = [...contract.matchAll(/`([^`]+)`/g)].map(([, heading]) => heading)
    const listed = [...index.matchAll(/\]\(\.\/([\w-]+\.md)\)/g)].map(([, file]) => file)

    expect(sections).toHaveLength(4)
    expect(listed.length).toBeGreaterThan(0)
    expect([...listed].sort()).toEqual([...recipes].sort())
    for (const file of listed) {
      const h2s = [...read(file).matchAll(/^## (.+)$/gm)].map(([, heading]) => heading.trim())
      expect({ file, h2s }).toEqual({ file, h2s: sections })
    }
  })
})
