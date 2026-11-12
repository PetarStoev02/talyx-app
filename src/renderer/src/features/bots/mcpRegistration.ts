import { z } from 'zod'
import { MCP_SERVER_NAME } from '../../../../shared/mcp'
import type { McpConnection } from '../../../../shared/mcp'
import type { RosterBackend } from './data'

const listSchema = z.object({
  servers: z.array(z.object({ name: z.string(), url: z.string().nullish() }))
})

/**
 * Adds Talyx's MCP server to the bot's profile, so the bot can operate Talyx. The token goes to the
 * profile's .env through the engine, never into its config. A profile that already names this
 * server at this address is left alone. REST, not the socket: the socket's `mcp.servers.*` refuse
 * a profile other than the one the socket serves.
 */
export async function registerMcpServer(
  backend: RosterBackend,
  profile: string,
  connection: McpConnection
): Promise<void> {
  const path = `/api/mcp/servers?${new URLSearchParams({ profile })}`
  const { servers } = listSchema.parse(await backend.http({ path, profile }))
  if (servers.some((server) => server.name === MCP_SERVER_NAME && server.url === connection.url))
    return
  // ponytail: the key is not compared (the engine never shows it); a new key (userData wiped)
  // leaves bots on the old one until their `talyx` server is removed, then the next start adds it.
  // ponytail: a server named `talyx` at another address (a changed port) stays; the add then fails
  // with the engine's "already exists" and the bot keeps the old address until it is removed.
  await backend.http({
    path,
    method: 'POST',
    body: {
      name: MCP_SERVER_NAME,
      url: connection.url,
      auth: 'header',
      bearer_token: connection.token
    },
    profile
  })
}
