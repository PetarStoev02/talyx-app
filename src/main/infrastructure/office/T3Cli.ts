export interface T3Thread {
  threadId: string
  projectId: string
  title: string
  status: string
  link: string | null
  updatedAt: string
  pendingRequestCount: number
}

/**
 * Runs the t3 binary and resolves with stdout. `input` is written to stdin.
 * The production implementation (wired in Task 8) must use a 30 s timeout
 * and a maxBuffer of 8 MB.
 */
type Run = (args: string[], input?: string) => Promise<string>
type Raw = Record<string, unknown>

export class T3OutputError extends Error {
  constructor(what: string) {
    super(`Unexpected t3 output: ${what}`)
    this.name = 'T3OutputError'
  }
}

const isRaw = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v)

function toThread(r: unknown): T3Thread {
  if (
    !isRaw(r) ||
    typeof r.threadId !== 'string' ||
    typeof r.projectId !== 'string' ||
    typeof r.status !== 'string'
  ) {
    throw new T3OutputError('thread without threadId, projectId and status')
  }
  return {
    threadId: r.threadId,
    projectId: r.projectId,
    title: typeof r.title === 'string' ? r.title : '',
    status: r.status,
    link: typeof r.link === 'string' ? r.link : null,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : '',
    pendingRequestCount: typeof r.pendingRequestCount === 'number' ? r.pendingRequestCount : 0
  }
}

export class T3Cli {
  constructor(private readonly run: Run) {}

  async listThreads(projectId: string): Promise<T3Thread[]> {
    const json: unknown = JSON.parse(
      await this.run(['thread', 'list', '--project', projectId, '--json'])
    )
    if (!Array.isArray(json)) throw new T3OutputError('thread list is not an array')
    return json.map(toThread)
  }

  async showThread(threadId: string): Promise<T3Thread> {
    const json: unknown = JSON.parse(await this.run(['thread', 'show', threadId, '--json']))
    if (!isRaw(json)) throw new T3OutputError('thread show is not an object')
    return toThread(json.thread)
  }

  // The message goes through stdin ('-') so text starting with '-' is never read as a flag.
  async startThread(projectId: string, message: string, title: string): Promise<string> {
    const out = (
      await this.run(['thread', 'start', projectId, '-', `--title=${title}`, '--json'], message)
    ).trim()
    try {
      const json: unknown = JSON.parse(out)
      if (isRaw(json)) {
        const id = json.threadId ?? (isRaw(json.thread) ? json.thread.threadId : undefined)
        if (typeof id === 'string') return id
      }
    } catch {
      // not JSON: the CLI printed the bare id
    }
    return out
  }

  async send(threadId: string, message: string): Promise<void> {
    await this.run(['thread', 'send', threadId, '-'], message)
  }
}
