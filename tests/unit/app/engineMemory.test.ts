import { describe, expect, it } from 'vitest'
import { engineMemoryBackend } from '../../../src/renderer/src/app/engine/memory'
import { RosterError } from '../../../src/renderer/src/features/bots/roster'
import type { EngineApiRequest, EngineHttp } from '../../../src/renderer/src/shared/engine/http'

type Route = (request: EngineApiRequest) => unknown

/** The engine's REST routes as the bot's memory screen reaches them, keyed `METHOD path`. */
function engineRest(routes: Record<string, Route>): {
  http: EngineHttp
  calls: EngineApiRequest[]
} {
  const calls: EngineApiRequest[] = []
  const http = (async (request: EngineApiRequest) => {
    calls.push(request)
    const path = new URL(request.path, 'http://engine').pathname
    const route = routes[`${request.method ?? 'GET'} ${path}`]
    if (!route) throw new Error(`No route ${request.method ?? 'GET'} ${request.path}`)
    return route(request)
  }) as EngineHttp
  return { http, calls }
}

const card = (source: string, body: string, fingerprint: string): Record<string, unknown> => ({
  source,
  body,
  title: body,
  fingerprint
})
const node = (id: string): Record<string, unknown> => ({ id, kind: 'memory' })
const BUILTIN = { active: '' }

describe('the memory screen over the engine', () => {
  it('should list each memory with its id, saying whom it is about', async () => {
    const { http, calls } = engineRest({
      'GET /api/learning/graph': () => ({
        nodes: [
          { id: 'web-search', kind: 'skill' },
          node('memory:memory:0:aa'),
          node('memory:profile:1:bb')
        ],
        memory: [
          card('memory', 'Reports go out on Mondays.', 'aa'),
          card('profile', 'Prefers euros.', 'bb')
        ]
      }),
      'GET /api/memory': () => BUILTIN
    })
    expect(await engineMemoryBackend({ http }).listMemories('analyst')).toEqual({
      memories: [
        { id: 'memory:memory:0:aa', text: 'Reports go out on Mondays.', about: 'bot' },
        { id: 'memory:profile:1:bb', text: 'Prefers euros.', about: 'user' }
      ],
      otherStore: null
    })
    expect(calls.every((call) => call.profile === 'analyst')).toBe(true)
  })

  it('should refuse a graph without memory ids rather than list memories it cannot change', async () => {
    const { http } = engineRest({
      'GET /api/learning/graph': () => ({ memory: [card('memory', 'Kept.', 'aa')] }),
      'GET /api/memory': () => BUILTIN
    })
    await expect(engineMemoryBackend({ http }).listMemories('analyst')).rejects.toThrow()
  })

  it('should list no memories for a bot with none', async () => {
    const { http } = engineRest({
      'GET /api/learning/graph': () => ({ nodes: [], memory: [] }),
      'GET /api/memory': () => BUILTIN
    })
    expect(await engineMemoryBackend({ http }).listMemories('analyst')).toEqual({
      memories: [],
      otherStore: null
    })
  })

  it('should read a memory the list cut short in full', async () => {
    const long = 'x'.repeat(1500)
    const { http } = engineRest({
      'GET /api/learning/graph': () => ({
        nodes: [node('memory:memory:0:aa')],
        memory: [card('memory', long.slice(0, 1200), 'aa')]
      }),
      'GET /api/learning/node': (request) => {
        expect(new URL(request.path, 'http://engine').searchParams.get('id')).toBe(
          'memory:memory:0:aa'
        )
        return { ok: true, content: long }
      },
      'GET /api/memory': () => BUILTIN
    })
    const [memory] = (await engineMemoryBackend({ http }).listMemories('analyst')).memories
    expect(memory.text).toBe(long)
  })

  it('should name the memory provider a bot keeps its memories in besides these', async () => {
    const { http } = engineRest({
      'GET /api/learning/graph': () => ({ nodes: [], memory: [] }),
      'GET /api/memory': () => ({ active: 'vector-db' })
    })
    expect((await engineMemoryBackend({ http }).listMemories('analyst')).otherStore).toBe(
      'vector-db'
    )
  })

  it('should send an edit and a delete for the memory the id names', async () => {
    const { http, calls } = engineRest({
      'PUT /api/learning/node': () => ({ ok: true }),
      'DELETE /api/learning/node': () => ({ ok: true })
    })
    const memory = engineMemoryBackend({ http })
    await memory.editMemory('analyst', { id: 'memory:memory:0:aa', text: 'Fridays.' })
    await memory.deleteMemory('analyst', 'memory:memory:0:aa')
    expect(calls).toMatchObject([
      {
        method: 'PUT',
        profile: 'analyst',
        body: { id: 'memory:memory:0:aa', content: 'Fridays.' }
      },
      { method: 'DELETE', profile: 'analyst', body: { id: 'memory:memory:0:aa' } }
    ])
  })

  it.each([
    [
      'changed since it was listed',
      'memory node id is stale - refresh the graph',
      'memory.errorChanged'
    ],
    [
      'too long for the bot’s memory',
      'Replacement would put memory at 2,400/2,200 chars. Shorten the new content.',
      'memory.errorFull'
    ]
  ] as const)('should say a memory %s in Talyx’s words', async (_, engineText, key) => {
    const { http } = engineRest({
      'PUT /api/learning/node': () => {
        throw new Error(engineText)
      }
    })
    const edit = engineMemoryBackend({ http }).editMemory('analyst', {
      id: 'memory:memory:0:aa',
      text: 'x'
    })
    await expect(edit).rejects.toBeInstanceOf(RosterError)
    await expect(edit).rejects.toMatchObject({ key })
  })

  it('should pass any other failure on as it came', async () => {
    const { http } = engineRest({
      'DELETE /api/learning/node': () => {
        throw new Error('fetch failed')
      }
    })
    await expect(engineMemoryBackend({ http }).deleteMemory('analyst', 'memory:x')).rejects.toThrow(
      'fetch failed'
    )
  })

  it('should list every skill, the ones turned off included, and turn one off', async () => {
    const { http, calls } = engineRest({
      'GET /api/skills': () => [
        { name: 'web-search', description: 'Search', enabled: true, provenance: 'bundled' },
        { name: 'cash-report', description: null, enabled: false, provenance: 'agent' }
      ],
      'PUT /api/skills/toggle': () => ({ ok: true })
    })
    const memory = engineMemoryBackend({ http })
    expect(await memory.listSkills('analyst')).toEqual([
      { name: 'web-search', description: 'Search', enabled: true, removable: false },
      { name: 'cash-report', description: '', enabled: false, removable: true }
    ])
    await memory.setSkillEnabled('analyst', { name: 'web-search', enabled: false })
    expect(calls.at(-1)).toMatchObject({
      method: 'PUT',
      profile: 'analyst',
      body: { name: 'web-search', enabled: false }
    })
  })

  it('should read, save and delete a skill under its name', async () => {
    const { http, calls } = engineRest({
      'GET /api/skills/content': (request) => {
        expect(new URL(request.path, 'http://engine').searchParams.get('name')).toBe('cash report')
        return { name: 'cash report', content: '# Cash' }
      },
      'PUT /api/skills/content': () => ({ success: true }),
      'DELETE /api/learning/node': () => ({ ok: true })
    })
    const memory = engineMemoryBackend({ http })
    expect(await memory.readSkill('analyst', 'cash report')).toBe('# Cash')
    await memory.editSkill('analyst', { name: 'cash report', text: '# Cash, weekly' })
    await memory.deleteSkill('analyst', 'cash report')
    expect(calls.slice(1)).toMatchObject([
      {
        method: 'PUT',
        profile: 'analyst',
        body: { name: 'cash report', content: '# Cash, weekly' }
      },
      { method: 'DELETE', profile: 'analyst', body: { id: 'cash report' } }
    ])
  })

  it('should say a pinned skill cannot be deleted, without the engine’s own command', async () => {
    const { http } = engineRest({
      'DELETE /api/learning/node': () => {
        throw new Error("'cash' is pinned - unpin it first (acme curator unpin cash)")
      }
    })
    const removal = engineMemoryBackend({ http }).deleteSkill('analyst', 'cash')
    await expect(removal).rejects.toMatchObject({ key: 'skills.errorPinned', detail: null })
  })

  it('should pass a timeout on as it came, so it keeps its own headline', async () => {
    const { http } = engineRest({
      'PUT /api/skills/content': () => {
        throw new Error('The operation timed out')
      }
    })
    await expect(
      engineMemoryBackend({ http }).editSkill('analyst', { name: 'cash', text: 'x' })
    ).rejects.toThrow('The operation timed out')
  })

  it('should say a skill the engine refused to save in Talyx’s words, keeping its reason', async () => {
    const { http } = engineRest({
      'PUT /api/skills/content': () => {
        throw new Error('SKILL.md must start with YAML frontmatter')
      }
    })
    await expect(
      engineMemoryBackend({ http }).editSkill('analyst', { name: 'cash', text: 'x' })
    ).rejects.toMatchObject({
      key: 'skills.errorRefused',
      detail: 'SKILL.md must start with YAML frontmatter'
    })
  })
})
