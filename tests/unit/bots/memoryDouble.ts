import type {
  MemoryBackend,
  MemoryList,
  Skill
} from '../../../src/renderer/src/features/bots/memory'
import { RosterError } from '../../../src/renderer/src/features/bots/roster'

export interface BotMind {
  memories: Array<{ text: string; about: 'bot' | 'user' }>
  /** A skill and its instructions file, empty unless a test reads it. */
  skills: Array<Skill & { text?: string }>
  otherStore?: string | null
}

export interface MemoryDouble {
  bots: Record<string, BotMind>
  backend: MemoryBackend
}

/**
 * Each bot's memories and skills in Talyx's terms. A memory's id holds its place and text, as
 * the engine's does, so ids change after a delete and an id for changed text is refused.
 */
export function memoryDouble(bots: Record<string, BotMind>): MemoryDouble {
  // A bot not set up here remembers nothing and has no skills.
  const mind = (bot: string): BotMind => (bots[bot] ??= { memories: [], skills: [] })
  const at = (bot: string, id: string): number => {
    const index = mind(bot).memories.findIndex((memory, i) => idOf(i, memory.text) === id)
    if (index < 0) throw new RosterError('memory.errorChanged')
    return index
  }
  const skillOf = (bot: string, name: string): BotMind['skills'][number] => {
    const skill = mind(bot).skills.find((item) => item.name === name)
    if (!skill) throw new Error(`No skill ${name}`)
    return skill
  }
  const backend: MemoryBackend = {
    listMemories: async (bot): Promise<MemoryList> => ({
      memories: mind(bot).memories.map((memory, i) => ({ id: idOf(i, memory.text), ...memory })),
      otherStore: mind(bot).otherStore ?? null
    }),
    editMemory: async (bot, { id, text }) => {
      mind(bot).memories[at(bot, id)].text = text
    },
    deleteMemory: async (bot, id) => {
      mind(bot).memories.splice(at(bot, id), 1)
    },
    listSkills: async (bot) =>
      mind(bot).skills.map(({ name, description, enabled, removable }) => ({
        name,
        description,
        enabled,
        removable
      })),
    setSkillEnabled: async (bot, { name, enabled }) => {
      skillOf(bot, name).enabled = enabled
    },
    readSkill: async (bot, name) => skillOf(bot, name).text ?? '',
    editSkill: async (bot, { name, text }) => {
      skillOf(bot, name).text = text
    },
    deleteSkill: async (bot, name) => {
      mind(bot).skills = mind(bot).skills.filter((skill) => skill.name !== name)
    }
  }
  return { bots, backend }
}

const idOf = (index: number, text: string): string => `${index}:${text}`
