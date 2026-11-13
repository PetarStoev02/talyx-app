import { MCP_SERVER_NAME } from '../../../../shared/mcp'
import type { McpConnection } from '../../../../shared/mcp'

/** A profile's MCP servers in its config, and the live ones its chats use. */
export interface McpServersBackend {
  listMcpServers: (profile: string) => Promise<{ name: string; url: string | null }[]>
  /** Adds the server; its key goes to the profile's .env through the engine, never its config. */
  addMcpServer: (
    profile: string,
    server: { name: string; url: string; token: string }
  ) => Promise<void>
  /** Removes the server from the profile's config; one already gone counts as removed. */
  removeMcpServer: (profile: string, name: string) => Promise<void>
  /**
   * Brings the profile's live MCP servers in step with its config, and the open chat's tools with
   * them. A chat that is answering right then keeps its tools until it is opened again.
   */
  reloadMcp: (bot: { profile: string; sessionId: string | null }) => Promise<void>
}

/**
 * Adds Talyx's MCP server to the bot's profile, so the bot can operate Talyx, and has its open chat
 * (`sessionId`) load the tools; true when the profile changed.
 *
 * The engine matches live servers to its config by name only, so a new address (other tools,
 * another port) is not picked up by an edit: the old entry is removed and the profile reloaded,
 * then the new one added and reloaded, and the chat then holds the current tools.
 */
export async function registerMcpServer(
  backend: McpServersBackend,
  bot: { profile: string; sessionId: string | null },
  connection: McpConnection
): Promise<boolean> {
  const { profile } = bot
  const servers = await backend.listMcpServers(profile)
  const current = servers.find((server) => server.name === MCP_SERVER_NAME)
  if (current?.url === connection.url) return false
  // ponytail: the key is not compared (the engine never shows it); a new key (userData wiped)
  // leaves bots on the old one until their `talyx` server is removed, then the next start adds it.
  const add = (): Promise<void> =>
    backend.addMcpServer(profile, {
      name: MCP_SERVER_NAME,
      url: connection.url,
      token: connection.token
    })
  if (current) {
    await backend.removeMcpServer(profile, MCP_SERVER_NAME)
    // The add runs even when this reload fails, so a bot is never left without the server; the
    // failure is still reported, and that bot keeps its old tools until the engine reconnects.
    try {
      await backend.reloadMcp(bot)
    } finally {
      await add()
    }
  } else await add()
  await backend.reloadMcp(bot)
  return true
}
