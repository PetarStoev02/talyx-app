import { describe, it, expect, beforeEach, vi } from 'vitest'
import { T3Watcher } from '../../../src/main/domain/office/services/T3Watcher'
import type { T3Cli, T3Thread } from '../../../src/main/infrastructure/office/T3Cli'
import type { BotSignal } from '../../../src/main/domain/office/model'

const thread = (over: Partial<T3Thread> = {}): T3Thread => ({
  threadId: 't1',
  projectId: 'p1',
  title: 'Fix',
  status: 'running',
  link: 'http://x/t1',
  updatedAt: 'u',
  pendingRequestCount: 0,
  ...over
})

describe('T3Watcher', () => {
  let threads: T3Thread[]
  let details: Record<string, T3Thread>
  let failList: boolean
  let owners: Record<string, string>
  let owned: string[]
  let statuses: Map<string, 'running' | 'waiting' | 'done'>
  let recorded: BotSignal[]
  let watcher: T3Watcher

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    threads = []
    details = {}
    failList = false
    owners = {}
    owned = []
    statuses = new Map()
    recorded = []
    const cli = {
      listThreads: async () => {
        if (failList) throw new Error('boom')
        return threads
      },
      showThread: async (id: string) => {
        const t = details[id] ?? threads.find((x) => x.threadId === id)
        if (!t) throw new Error('missing')
        return t
      }
    } as unknown as T3Cli
    watcher = new T3Watcher({
      cli,
      roster: { allBots: () => [{ id: 'bot', t3ProjectIds: ['p1'] }] } as never,
      signals: {
        threadOwner: (id: string) => owners[id] ?? null,
        ownedThreadIds: () => owned,
        latestT3Statuses: () => statuses
      } as never,
      record: { execute: (s: BotSignal) => recorded.push(s) } as never,
      now: () => new Date('2026-01-01T00:00:00Z')
    })
  })

  it('records a running thread in a mapped project for the mapped bot', async () => {
    threads = [thread()]
    await watcher.tick()
    expect(recorded).toEqual([
      {
        kind: 't3',
        botId: 'bot',
        t3ThreadId: 't1',
        title: 'Fix',
        status: 'running',
        link: 'http://x/t1',
        at: '2026-01-01T00:00:00.000Z'
      }
    ])
  })

  it('records done when a running thread completes, once', async () => {
    threads = [thread()]
    await watcher.tick()
    threads = [thread({ status: 'completed' })]
    await watcher.tick()
    await watcher.tick()
    expect(recorded.map((s) => s.kind === 't3' && s.status)).toEqual(['running', 'done'])
  })

  it('records waiting while a running thread has pending requests', async () => {
    threads = [thread()]
    await watcher.tick()
    details.t1 = thread({ pendingRequestCount: 1 })
    await watcher.tick()
    expect(recorded.map((s) => s.kind === 't3' && s.status)).toEqual(['running', 'waiting'])
  })

  it('prefers the bot that reported the thread id over the project mapping', async () => {
    owners.t1 = 'other'
    threads = [thread()]
    await watcher.tick()
    expect(recorded[0].botId).toBe('other')
  })

  it('skips threads nobody owns', async () => {
    threads = [thread({ projectId: 'unmapped' })]
    await watcher.tick()
    expect(recorded).toEqual([])
  })

  it('does not replay old threads on the first tick', async () => {
    threads = [thread({ status: 'completed' }), thread({ threadId: 't2', status: 'idle' })]
    await watcher.tick()
    expect(recorded).toEqual([])
  })

  it('follows owned threads outside any mapped project until they finish', async () => {
    owners.x = 'bot'
    owned = ['x']
    details.x = thread({ threadId: 'x', projectId: 'elsewhere' })
    await watcher.tick()
    details.x = thread({ threadId: 'x', projectId: 'elsewhere', status: 'completed' })
    await watcher.tick()
    details.x = thread({ threadId: 'x', projectId: 'elsewhere' })
    await watcher.tick()
    expect(recorded.map((s) => s.kind === 't3' && s.status)).toEqual(['running', 'done'])
  })

  it('reports disconnected when the cli fails and recovers on the next good tick', async () => {
    failList = true
    threads = [thread()]
    await watcher.tick()
    expect(watcher.connected()).toBe(false)
    expect(recorded).toEqual([])
    failList = false
    await watcher.tick()
    expect(watcher.connected()).toBe(true)
    expect(recorded).toHaveLength(1)
  })

  it('skips a thread whose show fails but stays connected', async () => {
    threads = [thread()]
    details = {}
    const failing = { ...threads[0] }
    threads = [failing]
    ;(
      watcher as unknown as { deps: { cli: { showThread: () => Promise<never> } } }
    ).deps.cli.showThread = async () => {
      throw new Error('x')
    }
    await watcher.tick()
    expect(watcher.connected()).toBe(true)
    expect(recorded).toEqual([])
  })

  it('resumes from the last recorded status after a restart', async () => {
    statuses.set('t1', 'running')
    threads = [thread({ status: 'completed' })]
    await watcher.tick()
    expect(recorded.map((s) => s.kind === 't3' && s.status)).toEqual(['done'])
  })

  it('does not re-record a running thread that was already recorded running', async () => {
    statuses.set('t1', 'running')
    threads = [thread()]
    await watcher.tick()
    expect(recorded).toEqual([])
  })

  it('records done once for a reported thread first seen already done', async () => {
    owners.t1 = 'bot'
    owned = ['t1']
    threads = [thread({ status: 'completed' })]
    await watcher.tick()
    await watcher.tick()
    expect(recorded.map((s) => s.kind === 't3' && s.status)).toEqual(['done'])
  })

  it('stops fetching a reported thread once it is done', async () => {
    owners.x = 'bot'
    owned = ['x']
    let shows = 0
    const cli = (watcher as unknown as { deps: { cli: { showThread: unknown } } }).deps.cli
    cli.showThread = async () => {
      shows++
      return thread({ threadId: 'x', projectId: 'elsewhere', status: 'completed' })
    }
    await watcher.tick()
    await watcher.tick()
    expect(shows).toBe(1)
  })

  it('records done for a running thread that disappears', async () => {
    owners.t1 = 'bot'
    owned = ['t1']
    threads = [thread()]
    await watcher.tick()
    threads = []
    await watcher.tick()
    await watcher.tick()
    expect(recorded.map((s) => s.kind === 't3' && s.status)).toEqual(['running'])
    await watcher.tick()
    expect(recorded.map((s) => s.kind === 't3' && s.status)).toEqual(['running', 'done'])
    expect(recorded[1]).toMatchObject({ botId: 'bot', t3ThreadId: 't1' })
    await watcher.tick()
    expect(recorded).toHaveLength(2)
  })

  it('does not count a failed list as a disappearance', async () => {
    owners.t1 = 'bot'
    owned = ['t1']
    threads = [thread()]
    await watcher.tick()
    failList = true
    for (let i = 0; i < 5; i++) await watcher.tick()
    expect(recorded).toHaveLength(1)
  })

  it('warns once per outage', async () => {
    const warn = vi.spyOn(console, 'warn')
    warn.mockClear()
    failList = true
    await watcher.tick()
    await watcher.tick()
    expect(warn).toHaveBeenCalledTimes(1)
    failList = false
    await watcher.tick()
    failList = true
    await watcher.tick()
    expect(warn).toHaveBeenCalledTimes(2)
  })
})
