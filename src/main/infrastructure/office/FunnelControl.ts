interface FunnelStatusJson {
  Web?: Record<string, { Handlers?: Record<string, { Proxy?: string }> }>
  AllowFunnel?: Record<string, boolean>
}

export interface FunnelStatus {
  on: boolean
  url: string | null
}

export class FunnelControl {
  constructor(private readonly run: (args: string[]) => Promise<string>) {}

  async enable(port: number): Promise<void> {
    await this.run(['funnel', '--bg', String(port)])
  }

  // Never `funnel reset`: the owner's T3 may use tailscale serve too.
  async disable(): Promise<void> {
    await this.run(['funnel', '--https=443', 'off'])
  }

  async status(port: number): Promise<FunnelStatus> {
    const json = JSON.parse(await this.run(['funnel', 'status', '--json'])) as FunnelStatusJson
    const target = `http://127.0.0.1:${port}`
    const host = Object.keys(json.AllowFunnel ?? {}).find(
      (h) =>
        json.AllowFunnel?.[h] === true &&
        Object.values(json.Web?.[h]?.Handlers ?? {}).some((x) => x.Proxy === target)
    )
    return host
      ? { on: true, url: `https://${host.replace(/:443$/, '')}` }
      : { on: false, url: null }
  }
}
