// Engine facts both processes need. Must not import 'electron' or node modules: it compiles in
// both the node and web tsconfigs.
//
// The gateway's wire strings and the profile metadata keys carry the engine's own name. That
// name is never written in this repo (not even in git history): main reads it at runtime from
// the first word of the engine's `--version` line and builds the strings here.

export interface EngineVersion {
  name: string
  version: string
  commit: string | null
}

export interface EngineWire {
  wsProtocol: string
  wsTicketPrefix: string
  ticketHeader: string
  botMetaKey: string
  botGroupsMetaKey: string
  /** The @handle the engine gives the default profile (Talyx) in messages between bots. */
  managerHandle: string
}

export type EngineStatus =
  | { state: 'missing'; enginePath: string | null }
  /**
   * `version` is what `--version` reported when the engine ran but could not attach; `reason` is
   * 'protocol' when the gateway speaks another protocol than this Talyx.
   */
  | { state: 'error'; message: string; version: string | null; reason: 'protocol' | null }
  | {
      state: 'attached'
      version: string
      commit: string | null
      home: string
      /** The gateway runs other code than the engine CLI (it outlived an update). */
      stale: boolean
      botMetaKey: string
      botGroupsMetaKey: string
      managerHandle: string
    }

/** The engine release this Talyx is built and tested against. */
export const EXPECTED_ENGINE_VERSION = '0.22.5'

export type EngineVersionFit = 'older' | 'same' | 'newer' | 'unknown'

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/

/** How a found engine version compares with the expected one, number by number (0.22.10 > 0.22.5). */
export function engineVersionFit(
  found: string | null,
  expected: string = EXPECTED_ENGINE_VERSION
): EngineVersionFit {
  const foundParts = found === null ? null : SEMVER.exec(found)
  const expectedParts = SEMVER.exec(expected)
  if (!foundParts || !expectedParts) return 'unknown'
  for (let i = 1; i <= 3; i++) {
    const difference = Number(foundParts[i]) - Number(expectedParts[i])
    if (difference !== 0) return difference < 0 ? 'older' : 'newer'
  }
  return 'same'
}

export class UnrecognizedEngineError extends Error {
  constructor(versionLine: string) {
    super(`Unrecognized engine: \`--version\` printed "${versionLine.slice(0, 80)}"`)
    this.name = 'UnrecognizedEngineError'
  }
}

const VERSION_LINE =
  /^([A-Za-z][A-Za-z0-9]*)\b.*?\bv(\d+\.\d+\.\d+)\b(?:.*?\blocal ([0-9a-f]{7,40})\b)?/

/** `<Name> Agent v0.22.5 (…) · stable · local bf0203a794a0` → name, version, short commit. */
export function parseEngineVersion(output: string): EngineVersion {
  const line = output.trim().split(/\r?\n/, 1)[0] ?? ''
  const match = VERSION_LINE.exec(line)
  if (!match) throw new UnrecognizedEngineError(line)
  return { name: match[1].toLowerCase(), version: match[2], commit: match[3]?.slice(0, 7) ?? null }
}

export function engineWire(name: string): EngineWire {
  const title = name.charAt(0).toUpperCase() + name.slice(1)
  return {
    wsProtocol: `${name}-gateway-v1`,
    wsTicketPrefix: `${name}-gateway-ticket.`,
    ticketHeader: `X-${title}-Gateway-Ticket`,
    botMetaKey: `${name}-bots`,
    botGroupsMetaKey: `${name}-bots-groups`,
    managerHandle: name
  }
}

/** One REST call to the engine gateway, proxied by main (which adds the one-use ticket). */
export interface EngineHttpRequest {
  path: string
  method?: string
  body?: unknown
  profile?: string | null
  timeoutMs?: number
}
