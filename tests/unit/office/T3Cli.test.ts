import { describe, it, expect } from 'vitest'
import { T3Cli, T3OutputError } from '../../../src/main/infrastructure/office/T3Cli'

describe('T3Cli', () => {
  it('parses thread list json', async () => {
    const calls: string[][] = []
    const cli = new T3Cli(async (args) => {
      calls.push(args)
      return JSON.stringify([
        {
          threadId: 't1',
          projectId: 'p',
          title: 'A',
          status: 'running',
          link: 'http://x/t1',
          updatedAt: 'u'
        }
      ])
    })
    const [t] = await cli.listThreads('p')
    expect(calls[0]).toEqual(['thread', 'list', '--project', 'p', '--json'])
    expect(t).toMatchObject({
      threadId: 't1',
      status: 'running',
      link: 'http://x/t1',
      pendingRequestCount: 0
    })
  })

  it('reads the pending request count from show', async () => {
    const cli = new T3Cli(async () =>
      JSON.stringify({
        thread: { threadId: 't1', projectId: 'p', status: 'running', pendingRequestCount: 2 },
        messages: []
      })
    )
    expect((await cli.showThread('t1')).pendingRequestCount).toBe(2)
  })

  it('returns the new thread id from start', async () => {
    const top = new T3Cli(async () => JSON.stringify({ threadId: 'n1' }))
    const nested = new T3Cli(async () => JSON.stringify({ thread: { threadId: 'n2' } }))
    const bare = new T3Cli(async () => ' n3\n')
    expect(await top.startThread('p', 'hi', 'T')).toBe('n1')
    expect(await nested.startThread('p', 'hi', 'T')).toBe('n2')
    expect(await bare.startThread('p', 'hi', 'T')).toBe('n3')
  })

  it('sends the message through stdin, not as an argument', async () => {
    const calls: { args: string[]; input?: string }[] = []
    const cli = new T3Cli(async (args, input) => {
      calls.push({ args, input })
      return '{"threadId":"n"}'
    })
    await cli.startThread('p', '--evil', 'T')
    await cli.send('t1', '--evil')
    expect(calls[0]).toEqual({
      args: ['thread', 'start', 'p', '-', '--title=T', '--json'],
      input: '--evil'
    })
    expect(calls[1]).toEqual({ args: ['thread', 'send', 't1', '-'], input: '--evil' })
  })

  it('rejects list output without thread ids', async () => {
    const noId = new T3Cli(async () => JSON.stringify([{ projectId: 'p', status: 'idle' }]))
    const notArray = new T3Cli(async () => '{}')
    await expect(noId.listThreads('p')).rejects.toBeInstanceOf(T3OutputError)
    await expect(notArray.listThreads('p')).rejects.toBeInstanceOf(T3OutputError)
  })
})
