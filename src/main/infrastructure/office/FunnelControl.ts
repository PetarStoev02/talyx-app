interface FunnelStatusJson {
  Web?: Record<string, { Handlers?: Record<string, { Proxy?: string }> }>
  AllowFunnel?: Record<string, boolean>
}

export interface FunnelStatus {
  on: boolean
  url: string | null
}

// A dedicated Funnel port, so Talyx never shares :443 with the owner's own `tailscale serve`.
const FUNNEL_PORT = 8443

export class FunnelControl {
  constructor(private readonly run: (args: string[]) => Promise<string>) {}

  async enable(port: number): Promise<void> {
    await this.run(['funnel', '--bg', `--https=${FUNNEL_PORT}`, String(port)])
  }

  // Never `funnel reset`: the owner's T3 may use tailscale serve too.
  async disable(): Promise<void> {
    await this.run(['funnel', `--https=${FUNNEL_PORT}`, 'off'])
  }

  async status(port: number): Promise<FunnelStatus> {
    const json = JSON.parse(await this.run(['funnel', 'status', '--json'])) as FunnelStatusJson
    const target = `http://127.0.0.1:${port}`
    const host = Object.keys(json.AllowFunnel ?? {}).find(
      (h) =>
        h.endsWith(`:${FUNNEL_PORT}`) &&
        json.AllowFunnel?.[h] === true &&
        Object.values(json.Web?.[h]?.Handlers ?? {}).some((x) => x.Proxy === target)
    )
    // The status key is already `<host>.ts.net:8443`, which is the public URL's authority.
    return host ? { on: true, url: `https://${host}` } : { on: false, url: null }
  }
}
