import { z } from 'zod'
import type { McpToolsBackend } from '@features/bots/mcp'
import type { McpServersBackend } from '@features/bots/mcpRegistration'
import { readRoomLog, sendRoomMessage } from '@shared/engine/rooms'
import type { EngineAccess } from './access'

const listSchema = z.object({
  servers: z.array(z.object({ name: z.string(), url: z.string().nullish() }))
})

/** A room log row, as much of it as the history reads. */
interface LogEvent {
  seq: number
  kind: string
  actor: { id: string; display_name?: string }
  payload: { text?: unknown }
  created_at: number
}

/** Talyx's MCP server on each profile, and the calls only Talyx's MCP tools make. */
export function engineMcpBackend(engine: EngineAccess): McpServersBackend & McpToolsBackend {
  // REST, not the socket: the socket's `mcp.servers.*` refuse a profile other than the one the
  // socket serves.
  const serversPath = (profile: string): string =>
    `/api/mcp/servers?${new URLSearchParams({ profile })}`
  return {
    listMcpServers: async (profile) =>
      listSchema.parse(await engine.http({ path: serversPath(profile), profile })).servers,
    addMcpServer: async (profile, { name, url, token }) => {
      await engine.http({
        path: serversPath(profile),
        method: 'POST',
        body: { name, url, auth: 'header', bearer_token: token },
        profile
      })
    },
    removeMcpServer: async (profile, name) => {
      await engine
        .http({
          path: `/api/mcp/servers/${name}?${new URLSearchParams({ profile })}`,
          method: 'DELETE',
          profile
        })
        // Removed meanwhile (another window, the user): nothing is left to remove.
        .catch((error: unknown) => {
          if (!/not found/i.test(error instanceof Error ? error.message : String(error)))
            throw error
        })
    },
    // A chat answering right then gets `busy` from the engine, which applies nothing to it.
    reloadMcp: async ({ profile, sessionId }) => {
      await engine.request(profile, 'reload.mcp', {
        confirm: true,
        ...(sessionId ? { session_id: sessionId } : {})
      })
    },
    setReasoning: async (profile, level) => {
      await engine.http({
        path: `/api/config?${new URLSearchParams({ profile })}`,
        method: 'PUT',
        body: { config: { agent: { reasoning_effort: level } } },
        profile
      })
    },
    sendRoomMessage: (roomId, text) =>
      sendRoomMessage(engine.request, {
        roomId,
        eventId: crypto.randomUUID(),
        text,
        attachments: []
      }),
    roomMessages: async (roomId) => {
      const events = await readRoomLog<LogEvent>(engine.request, roomId, 0)
      return events.flatMap((event) => {
        const text = typeof event.payload.text === 'string' ? event.payload.text.trim() : ''
        if (!text || (event.kind !== 'message.user' && event.kind !== 'message.member')) return []
        const user = event.kind === 'message.user'
        return [
          {
            seq: event.seq,
            memberId: user ? null : event.actor.id,
            memberName: user ? null : (event.actor.display_name ?? null),
            text,
            at: event.created_at
          }
        ]
      })
    }
  }
}
