import { memoryDouble } from '../../unit/bots/memoryDouble'
import type { MemoryDouble } from '../../unit/bots/memoryDouble'
import type { Skill } from '../../../src/renderer/src/features/bots/memory'

// Skills every bot has, built in; the last one is turned off.
const SKILLS: Array<[name: string, description: string, enabled: boolean]> = [
  ['web-search', 'Search the web and read pages.', true],
  ['spreadsheets', 'Read and write CSV and Excel files.', true],
  ['calendar', 'Read and book calendar events.', true],
  ['image-generation', 'Draw images from a prompt.', false]
]

const instructions = (name: string, description: string): string =>
  `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n\n${description}\n`

const builtIn = (): Array<Skill & { text: string }> =>
  SKILLS.map(([name, description, enabled]) => ({
    name,
    description,
    enabled,
    removable: false,
    text: instructions(name, description)
  }))

/**
 * Each bot's memories and skills, in memory. Analyst remembers a few things, one of them about
 * the user, and made one skill of its own (the only one it can delete); Researcher also keeps memories in another store; every other bot remembers nothing.
 */
export function fixtureMemory(bots: string[]): MemoryDouble {
  const minds = Object.fromEntries(
    bots.map((bot) => [bot, { memories: [], skills: builtIn() }])
  ) as Parameters<typeof memoryDouble>[0]
  minds.analyst.memories = [
    { text: 'The weekly report goes out on Monday at 09:00.', about: 'bot' },
    { text: 'Revenue is reported in euros, rounded to thousands.', about: 'bot' },
    { text: 'The user is the head of finance and reads on their phone.', about: 'user' }
  ]
  const cash = 'Weekly cash position from the bank exports.'
  minds.analyst.skills.push({
    name: 'cash-report',
    description: cash,
    enabled: true,
    removable: true,
    text: instructions('cash-report', cash)
  })
  minds.researcher.otherStore = 'vector-db'
  return memoryDouble(minds)
}
