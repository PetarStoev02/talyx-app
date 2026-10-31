export interface T3Thread {
  threadId: string
  projectId: string
  title: string
  status: string
  link: string | null
  updatedAt: string
  pendingRequestCount: number
}

type Run = (args: string[]) => Promise<string>
type Raw = Record<string, unknown>

const toThread = (r: Raw): T3Thread => ({
  threadId: String(r.threadId),
  projectId: String(r.projectId),
  title: String(r.title ?? ''),
  status: String(r.status ?? ''),
  link: typeof r.link === 'string' ? r.link : null,
  updatedAt: String(r.updatedAt ?? ''),
  pendingRequestCount: typeof r.pendingRequestCount === 'number' ? r.pendingRequestCount : 0
})

export class T3Cli {
  constructor(private readonly run: Run) {}

  async listThreads(projectId: string): Promise<T3Thread[]> {
    const out = await this.run(['thread', 'list', '--project', projectId, '--json'])
    return (JSON.parse(out) as Raw[]).map(toThread)
  }

  async showThread(threadId: string): Promise<T3Thread> {
    const out = await this.run(['thread', 'show', threadId, '--json'])
    return toThread((JSON.parse(out) as { thread: Raw }).thread)
  }

  async startThread(projectId: string, message: string, title: string): Promise<string> {
    const out = (
      await this.run(['thread', 'start', projectId, message, '--title', title, '--json'])
    ).trim()
    try {
      const json = JSON.parse(out) as Raw & { thread?: Raw }
      const id = json.threadId ?? json.thread?.threadId
      if (typeof id === 'string') return id
    } catch {
      // not JSON: the CLI printed the bare id
    }
    return out
  }

  async send(threadId: string, message: string): Promise<void> {
    await this.run(['thread', 'send', threadId, message])
  }
}
