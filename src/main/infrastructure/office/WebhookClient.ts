const TIMEOUT_MS = 10_000

export class WebhookRejectedError extends Error {
  constructor(readonly status: number) {
    super(`webhook rejected the task with HTTP ${status}`)
    this.name = 'WebhookRejectedError'
  }
}

export class WebhookTimeoutError extends Error {
  constructor() {
    super('webhook timed out')
    this.name = 'WebhookTimeoutError'
  }
}

export class WebhookClient {
  constructor(private readonly fetchFn: typeof fetch) {}

  async trigger(url: string, key: string, body: object): Promise<void> {
    let res: Response
    try {
      res = await this.fetchFn(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS)
      })
    } catch (e) {
      // Re-throw without the original error: its message may carry the URL.
      if (e instanceof Error && e.name === 'TimeoutError') throw new WebhookTimeoutError()
      throw new Error('webhook unreachable')
    }
    if (!res.ok) throw new WebhookRejectedError(res.status)
  }
}
