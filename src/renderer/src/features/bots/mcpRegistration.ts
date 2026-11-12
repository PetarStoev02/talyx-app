import { z } from 'zod'
import { MCP_SERVER_NAME } from '../../../../shared/mcp'
import type { McpConnection } from '../../../../shared/mcp'
import type { RosterBackend } from './data'

const listSchema = z.object({
  servers: z.array(z.object({ name: z.string(), url: z.string().nullish() }))
})

/**
 * Adds Talyx's MCP server to the bot's profile, so the bot can operate Talyx, and has its open chat
 * (`sessionId`) load the tools; true when the profile changed. The token goes to the profile's .env
 * through the engine, never into its config. REST, not the socket: the socket's `mcp.servers.*`
 * refuse a profile other than the one the socket serves.
 *
 * The engine matches live servers to its config by name only, so a new address (other tools,
 * another port) is not picked up by an edit: the old entry is removed and the profile reloaded,
 * then the new one added and reloaded, and the chat then holds the current tools.
 */
export async function registerMcpServer(
  backend: RosterBackend,
  bot: { profile: string; sessionId: string | null },
  connection: McpConnection
): Promise<boolean> {
  const { profile } = bot
  const path = `/api/mcp/servers?${new URLSearchParams({ profile })}`
  const { servers } = listSchema.parse(await backend.http({ path, profile }))
  const current = servers.find((server) => server.name === MCP_SERVER_NAME)
  if (current?.url === connection.url) return false
  // ponytail: the key is not compared (the engine never shows it); a new key (userData wiped)
  // leaves bots on the old one until their `talyx` server is removed, then the next start adds it.
  if (current) {
    await backend
      .http({
        path: `/api/mcp/servers/${MCP_SERVER_NAME}?${new URLSearchParams({ profile })}`,
        method: 'DELETE',
        profile
      })
      // Removed meanwhile (another window, the user): the add below is all that is left to do.
      .catch((error: unknown) => {
        if (!/not found/i.test(error instanceof Error ? error.message : String(error))) throw error
      })
    await reloadMcp(backend, bot)
  }
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
  await reloadMcp(backend, bot)
  return true
}

/**
 * Brings the profile's live MCP servers in step with its config, and the open chat's tools with
 * them. The engine waits while the chat is answering.
 */
async function reloadMcp(
  backend: RosterBackend,
  { profile, sessionId }: { profile: string; sessionId: string | null }
): Promise<void> {
  await backend.request(profile, 'reload.mcp', {
    confirm: true,
    ...(sessionId ? { session_id: sessionId } : {})
  })
}
