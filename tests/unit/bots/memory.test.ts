import { beforeEach, describe, expect, it } from 'vitest'
import {
  deleteMemory,
  deleteSkill,
  editMemory,
  editSkill,
  filterMemories,
  filterSkills,
  loadMemories,
  loadSkillText,
  loadSkills,
  setSkillEnabled
} from '../../../src/renderer/src/features/bots/memory'
import type { MemoryBackend, Skill } from '../../../src/renderer/src/features/bots/memory'
import { RosterError } from '../../../src/renderer/src/features/bots/roster'
import { memoryDouble } from './memoryDouble'
import type { MemoryDouble } from './memoryDouble'

const BOT = 'analyst'

let engine: MemoryDouble
let backend: MemoryBackend

beforeEach(() => {
  engine = memoryDouble({
    [BOT]: {
      memories: [
        { text: 'Reports go out on Mondays.', about: 'bot' },
        { text: 'The user prefers euros.', about: 'user' }
      ],
      skills: [
        { name: 'web-search', description: 'Search the web', enabled: true, removable: false },
        {
          name: 'cash-report',
          description: 'Weekly cash position',
          enabled: false,
          removable: true,
          text: '# Cash report'
        }
      ]
    }
  })
  backend = engine.backend
})

describe('memories', () => {
  it('should list nothing for a bot that remembers nothing', async () => {
    engine.bots[BOT].memories = []
    expect((await loadMemories(backend, BOT)).memories).toEqual([])
  })

  it('should list what the bot remembers about its work and about the user', async () => {
    const { memories, otherStore } = await loadMemories(backend, BOT)
    expect(memories.map(({ text, about }) => ({ text, about }))).toEqual([
      { text: 'Reports go out on Mondays.', about: 'bot' },
      { text: 'The user prefers euros.', about: 'user' }
    ])
    expect(otherStore).toBeNull()
  })

  it('should name the other store a bot keeps its memories in', async () => {
    engine.bots[BOT].otherStore = 'vector-db'
    expect((await loadMemories(backend, BOT)).otherStore).toBe('vector-db')
  })

  it('should save an edited memory and return the list as it is now', async () => {
    const [first] = (await loadMemories(backend, BOT)).memories
    const list = await editMemory(backend, BOT, {
      id: first.id,
      text: '  Reports go out on Fridays. '
    })
    expect(list.memories.map((memory) => memory.text)).toEqual([
      'Reports go out on Fridays.',
      'The user prefers euros.'
    ])
  })

  it('should refuse an empty memory and leave it as it was', async () => {
    const [first] = (await loadMemories(backend, BOT)).memories
    await expect(editMemory(backend, BOT, { id: first.id, text: '   ' })).rejects.toMatchObject(
      new RosterError('memory.errorEmpty')
    )
    expect(engine.bots[BOT].memories[0].text).toBe('Reports go out on Mondays.')
  })

  it('should delete a memory and return the remaining ones with their new ids', async () => {
    const [first, second] = (await loadMemories(backend, BOT)).memories
    const list = await deleteMemory(backend, BOT, first.id)
    expect(list.memories.map((memory) => memory.text)).toEqual(['The user prefers euros.'])
    expect(list.memories[0].id).not.toBe(second.id)
  })

  it('should delete the last memory and list none', async () => {
    engine.bots[BOT].memories = [{ text: 'Only one.', about: 'bot' }]
    const [only] = (await loadMemories(backend, BOT)).memories
    expect((await deleteMemory(backend, BOT, only.id)).memories).toEqual([])
  })
})

describe('memory filter', () => {
  const memories = [
    { id: '0', text: 'Reports go out on MONDAYS.', about: 'bot' as const },
    { id: '1', text: 'The user prefers euros.', about: 'user' as const }
  ]

  it('should keep every memory for an empty query', () => {
    expect(filterMemories(memories, ' ')).toEqual(memories)
  })

  it('should match the text, ignoring case', () => {
    expect(filterMemories(memories, 'mondays').map((memory) => memory.id)).toEqual(['0'])
  })

  it('should find nothing for a query no memory matches', () => {
    expect(filterMemories(memories, 'zebra')).toEqual([])
  })
})

describe('skills', () => {
  it('should list a bot with no skills as empty', async () => {
    engine.bots[BOT].skills = []
    expect(await loadSkills(backend, BOT)).toEqual([])
  })

  it('should list every skill by name, the ones turned off included', async () => {
    expect(await loadSkills(backend, BOT)).toEqual([
      {
        name: 'cash-report',
        description: 'Weekly cash position',
        enabled: false,
        removable: true
      },
      { name: 'web-search', description: 'Search the web', enabled: true, removable: false }
    ])
  })

  it('should read a skill as its instructions file', async () => {
    expect(await loadSkillText(backend, BOT, 'cash-report')).toBe('# Cash report')
  })

  it('should save a skill’s new instructions', async () => {
    await editSkill(backend, BOT, { name: 'cash-report', text: '# Cash, weekly' })
    expect(await loadSkillText(backend, BOT, 'cash-report')).toBe('# Cash, weekly')
  })

  it('should refuse empty instructions and leave the skill as it was', async () => {
    await expect(
      editSkill(backend, BOT, { name: 'cash-report', text: '  ' })
    ).rejects.toMatchObject(new RosterError('skills.errorEmpty'))
    expect(await loadSkillText(backend, BOT, 'cash-report')).toBe('# Cash report')
  })

  it('should delete a skill the bot made', async () => {
    const [cash] = await loadSkills(backend, BOT)
    await deleteSkill(backend, BOT, cash)
    expect((await loadSkills(backend, BOT)).map((skill) => skill.name)).toEqual(['web-search'])
  })

  it('should refuse to delete a skill the bot did not make, and keep it', async () => {
    const [, web] = await loadSkills(backend, BOT)
    await expect(deleteSkill(backend, BOT, web)).rejects.toMatchObject(
      new RosterError('skills.errorBuiltIn')
    )
    expect((await loadSkills(backend, BOT)).map((skill) => skill.name)).toContain('web-search')
  })

  it.each([
    ['on', 'cash-report', true],
    ['off', 'web-search', false]
  ])('should turn a skill %s', async (_, name, enabled) => {
    await setSkillEnabled(backend, BOT, { name, enabled })
    expect((await loadSkills(backend, BOT)).find((skill) => skill.name === name)?.enabled).toBe(
      enabled
    )
  })

  describe('filter', () => {
    const skills: Skill[] = [
      { name: 'web-search', description: 'Search the web', enabled: true, removable: false },
      { name: 'cash-report', description: 'Weekly CASH position', enabled: false, removable: true }
    ]

    it('should keep every skill for an empty query', () => {
      expect(filterSkills(skills, '  ')).toEqual(skills)
    })

    it('should match the name or the description, ignoring case', () => {
      expect(filterSkills(skills, 'WEB').map((skill) => skill.name)).toEqual(['web-search'])
      expect(filterSkills(skills, 'cash pos').map((skill) => skill.name)).toEqual(['cash-report'])
    })

    it('should find nothing for a query no skill matches', () => {
      expect(filterSkills(skills, 'zebra')).toEqual([])
    })
  })
})
