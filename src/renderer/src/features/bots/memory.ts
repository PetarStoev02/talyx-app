import { RosterError } from './roster'

/** One thing a bot remembers: about its work (`bot`) or about the user (`user`). */
export interface Memory {
  /** Names the memory by its text and place: it changes with any edit, so lists are read again. */
  id: string
  text: string
  about: 'bot' | 'user'
}

export interface MemoryList {
  memories: Memory[]
  /** A memory store the bot keeps besides these, which Talyx cannot show; null when none. */
  otherStore: string | null
}

export interface Skill {
  name: string
  description: string
  enabled: boolean
  /** A skill the bot learned or the user made; built-in and installed ones cannot be deleted. */
  removable: boolean
}

/** What the bot's memory screen needs of the engine, in Talyx's terms. */
export interface MemoryBackend {
  listMemories: (bot: string) => Promise<MemoryList>
  editMemory: (bot: string, edit: { id: string; text: string }) => Promise<void>
  deleteMemory: (bot: string, id: string) => Promise<void>
  /** Every skill the bot has, the ones turned off included. */
  listSkills: (bot: string) => Promise<Skill[]>
  setSkillEnabled: (bot: string, change: { name: string; enabled: boolean }) => Promise<void>
  /** The skill's instructions file, as the bot reads it. */
  readSkill: (bot: string, name: string) => Promise<string>
  editSkill: (bot: string, edit: { name: string; text: string }) => Promise<void>
  deleteSkill: (bot: string, name: string) => Promise<void>
}

export function loadMemories(backend: MemoryBackend, bot: string): Promise<MemoryList> {
  return backend.listMemories(bot)
}

/** Saves the memory's new text and returns the list again, with the memory's new id. */
export async function editMemory(
  backend: MemoryBackend,
  bot: string,
  edit: { id: string; text: string }
): Promise<MemoryList> {
  const text = edit.text.trim()
  if (!text) throw new RosterError('memory.errorEmpty')
  await backend.editMemory(bot, { id: edit.id, text })
  return backend.listMemories(bot)
}

/** Deletes the memory and returns the rest, whose ids have moved. */
export async function deleteMemory(
  backend: MemoryBackend,
  bot: string,
  id: string
): Promise<MemoryList> {
  await backend.deleteMemory(bot, id)
  return backend.listMemories(bot)
}

export async function loadSkills(backend: MemoryBackend, bot: string): Promise<Skill[]> {
  const skills = await backend.listSkills(bot)
  return skills.sort((a, b) => a.name.localeCompare(b.name))
}

export function setSkillEnabled(
  backend: MemoryBackend,
  bot: string,
  change: { name: string; enabled: boolean }
): Promise<void> {
  return backend.setSkillEnabled(bot, change)
}

export function loadSkillText(backend: MemoryBackend, bot: string, name: string): Promise<string> {
  return backend.readSkill(bot, name)
}

/** Saves the skill's instructions; read the skills again after, as its description may change. */
export async function editSkill(
  backend: MemoryBackend,
  bot: string,
  edit: { name: string; text: string }
): Promise<void> {
  if (!edit.text.trim()) throw new RosterError('skills.errorEmpty')
  await backend.editSkill(bot, edit)
}

/** Deletes a skill the bot made; any other one is refused, since the engine keeps those. */
export async function deleteSkill(
  backend: MemoryBackend,
  bot: string,
  skill: Skill
): Promise<void> {
  if (!skill.removable) throw new RosterError('skills.errorBuiltIn')
  await backend.deleteSkill(bot, skill.name)
}

/** The memories whose text holds the query, ignoring case. */
export function filterMemories(memories: Memory[], query: string): Memory[] {
  return matching(memories, query, (memory) => memory.text)
}

/** The skills whose name or description holds the query, ignoring case. */
export function filterSkills(skills: Skill[], query: string): Skill[] {
  return matching(skills, query, (skill) => `${skill.name}\n${skill.description}`)
}

function matching<T>(items: T[], query: string, textOf: (item: T) => string): T[] {
  const words = query.trim().toLowerCase()
  if (!words) return items
  return items.filter((item) => textOf(item).toLowerCase().includes(words))
}
