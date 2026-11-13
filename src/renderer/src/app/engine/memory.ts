import { z } from 'zod'
import { RosterError } from '@features/bots/roster'
import type { Memory, MemoryBackend } from '@features/bots/memory'
import type { EngineHttp } from '@shared/engine/http'
import type { TranslationKey } from '@shared/lib/i18n'
import { problemOf } from '@shared/lib/problem'
import type { EngineAccess } from './access'

// The engine's graph lists a memory's text cut at this length; a longer one is read in full.
const LISTED_TEXT_LIMIT = 1200
// The engine's source for USER.md, what the bot knows of the user.
const USER_SOURCE = 'profile'
const MEMORY_KIND = 'memory'
const NODE = '/api/learning/node'
// How the engine words an id from before a change, and a memory past the bot's limit.
const STALE = /\bstale\b/i
const OVER_LIMIT = /would put memory at/i

const graphSchema = z.object({
  nodes: z.array(z.object({ id: z.string(), kind: z.string() })),
  memory: z.array(z.object({ source: z.string(), body: z.string() }))
})
const nodeSchema = z.object({ content: z.string() })
const providerSchema = z.object({ active: z.string().nullish() })
const skillsSchema = z.array(
  z.object({
    name: z.string(),
    description: z.string().nullish(),
    enabled: z.boolean().catch(true),
    provenance: z.string().nullish()
  })
)
const skillContentSchema = z.object({ content: z.string() })
// The engine's word for a skill the bot learned or a person made, the only kind it deletes.
const MADE_HERE = 'agent'
const SKILL_CONTENT = '/api/skills/content'
const UNEXPECTED: TranslationKey = 'error.unexpected'
// How the engine refuses to delete a pinned skill; its words name a command of its own.
const PINNED = /\bpinned\b/i

/** The bot's memories (its MEMORY.md and USER.md entries) and skills over the engine's REST. */
export function engineMemoryBackend({ http }: Pick<EngineAccess, 'http'>): MemoryBackend {
  return {
    listMemories: async (bot) => {
      const [memories, provider] = await Promise.all([
        readMemories(http, bot),
        http({ path: '/api/memory', profile: bot })
      ])
      // An empty name is the built-in store, the one listed here.
      return { memories, otherStore: providerSchema.parse(provider).active || null }
    },
    editMemory: (bot, { id, text }) =>
      changed(http({ path: NODE, method: 'PUT', profile: bot, body: { id, content: text } })),
    deleteMemory: (bot, id) =>
      changed(http({ path: NODE, method: 'DELETE', profile: bot, body: { id } })),
    listSkills: async (bot) =>
      skillsSchema
        .parse(await http({ path: '/api/skills', profile: bot }))
        .map(({ name, description, enabled, provenance }) => ({
          name,
          description: description ?? '',
          enabled,
          removable: provenance === MADE_HERE
        })),
    setSkillEnabled: async (bot, { name, enabled }) => {
      await http({
        path: '/api/skills/toggle',
        method: 'PUT',
        profile: bot,
        body: { name, enabled }
      })
    },
    readSkill: async (bot, name) =>
      skillContentSchema.parse(
        await http({ path: `${SKILL_CONTENT}?${new URLSearchParams({ name })}`, profile: bot })
      ).content,
    editSkill: (bot, { name, text }) =>
      refused(
        http({ path: SKILL_CONTENT, method: 'PUT', profile: bot, body: { name, content: text } })
      ),
    // The engine archives a deleted skill: it can restore it, Talyx does not.
    deleteSkill: (bot, name) =>
      refused(http({ path: NODE, method: 'DELETE', profile: bot, body: { id: name } }))
  }
}

// The graph lists memory cards and their nodes in the same order: each node holds the id.
async function readMemories(http: EngineHttp, bot: string): Promise<Memory[]> {
  const graph = graphSchema.parse(await http({ path: '/api/learning/graph', profile: bot }))
  const ids = graph.nodes.filter((node) => node.kind === MEMORY_KIND).map((node) => node.id)
  return Promise.all(
    graph.memory.map(async (card, index) => {
      const id = ids[index]
      const text =
        card.body.length < LISTED_TEXT_LIMIT ? card.body : await readMemory(http, bot, id)
      return { id, text: text.trim(), about: card.source === USER_SOURCE ? 'user' : 'bot' }
    })
  )
}

async function readMemory(http: EngineHttp, bot: string, id: string): Promise<string> {
  const path = `${NODE}?${new URLSearchParams({ id })}`
  return nodeSchema.parse(await http({ path, profile: bot })).content
}

async function changed(request: Promise<unknown>): Promise<void> {
  try {
    await request
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error)
    if (STALE.test(text)) throw new RosterError('memory.errorChanged')
    if (OVER_LIMIT.test(text)) throw new RosterError('memory.errorFull')
    throw error
  }
}

// The engine says why it refused a skill (its format, its size, a security scan, a pin).
async function refused(request: Promise<unknown>): Promise<void> {
  try {
    await request
  } catch (error) {
    // A timeout or an engine out of reach keeps its own headline.
    if (problemOf(error).key !== UNEXPECTED) throw error
    if (PINNED.test(String(error))) throw new RosterError('skills.errorPinned')
    throw new RosterError('skills.errorRefused', error instanceof Error ? error.message : null)
  }
}
