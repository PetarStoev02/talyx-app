// The three core flows (create a bot, send it a message, get a reply), driven through the
// renderer's own use cases. `window.api` is built by the same `buildApi` the preload uses, over a
// transport that calls main's engine code directly, so every layer below the DOM is the real one.
import { vi } from 'vitest'
import { buildApi } from '../../src/shared/api'
import {
  EngineHttpRequestSchema,
  EngineSocketIdSchema,
  EngineSocketTextSchema,
  ProfileNameSchema
} from '../../src/shared/channels'
import type { Engine } from '../../src/main/infrastructure/engine/engine'
import type { EngineSockets } from '../../src/main/infrastructure/engine/engineSockets'
import { engineAccess } from '../../src/renderer/src/app/engine/access'
import { engineChatBackend } from '../../src/renderer/src/app/engine/chat'
import { engineProvidersBackend } from '../../src/renderer/src/app/engine/providers'
import { engineRosterBackend } from '../../src/renderer/src/app/engine/roster'
import { refreshRoster } from '../../src/renderer/src/features/bots/actions'
import { createBot, IncompleteBotError } from '../../src/renderer/src/features/bots/create'
import { confirmBotModel } from '../../src/renderer/src/features/bots/details'
import { matchName } from '../../src/renderer/src/features/bots/look'
import { useRoster } from '../../src/renderer/src/features/bots/store'
import {
  chatActions,
  type ChatActions,
  type ResumeSnapshot
} from '../../src/renderer/src/features/chat/chat'
import { useChat } from '../../src/renderer/src/features/chat/store'
import {
  saveEndpoint,
  type ProvidersBackend
} from '../../src/renderer/src/features/providers/providers'
import { host } from '../../src/renderer/src/shared/engine/host'

const SCRATCH_ENDPOINT = 'Smoke endpoint'
const PROMPT = 'Reply with the single word: pong'
// An error the engine stores as the bot's message is not a reply.
const REPLY = /pong/i
const REPLY_TIMEOUT_MS = 120_000
const POLL_MS = 1_000
// Enough of the newest messages to hold the reply behind any tool rows.
const RECENT_LIMIT = 20
// The engine stores the avatar as given; a 1x1 PNG is enough for the call to succeed.
const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

type RosterBackend = ReturnType<typeof engineRosterBackend>

/** The renderer's side, connected to the engine the smoke test installed. */
export interface Renderer {
  roster: RosterBackend
  chat: ChatActions
  providers: ProvidersBackend
}

/** An OpenAI-compatible endpoint the scratch bot answers through. */
export interface ScratchProvider {
  baseUrl: string
  apiKey: string
  model: string
}

/** Stubs `window.api` over main's engine code and opens the renderer's shared socket. */
export async function connectRenderer(
  engine: Engine,
  sockets: EngineSockets,
  keys: { botMetaKey: string; botGroupsMetaKey: string }
): Promise<Renderer> {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>()
  const emit = (channel: string, ...args: unknown[]): void => {
    for (const listener of listeners.get(channel) ?? []) listener(...args)
  }
  // Main's engine handlers (engine.ipc.ts), with the same input schemas; the flows use no other
  // channel, so any other one fails by name.
  const handlers: Record<string, (...args: unknown[]) => unknown> = {
    'engine:status': () => engine.status(),
    'engine:http': (request) => engine.http(EngineHttpRequestSchema.parse(request)),
    'engine:socket-open': (id, profile) =>
      sockets.open(
        EngineSocketIdSchema.parse(id),
        ProfileNameSchema.parse(profile),
        (channel, ...args) => emit(channel, ...args)
      ),
    'engine:socket-send': (id, text) =>
      sockets.send(EngineSocketIdSchema.parse(id), EngineSocketTextSchema.parse(text)),
    'engine:socket-close': (id) => sockets.close(EngineSocketIdSchema.parse(id))
  }
  const api = buildApi({
    invoke: async (channel, ...args) => {
      const handler = handlers[channel]
      if (!handler) throw new Error(`Smoke: no handler for ${channel}`)
      return handler(...args)
    },
    on: (channel, listener) => {
      const set = listeners.get(channel) ?? new Set()
      listeners.set(channel, set.add(listener))
      return () => set.delete(listener)
    }
  })
  vi.stubGlobal('window', { api })
  await host.connect()
  const roster = engineRosterBackend(engineAccess, {
    ...keys,
    deleteProfile: async (profile) => {
      await host.deleteProfile(profile)
    },
    avatarPng: async () => TINY_PNG,
    setRoomMembers: async () => {
      throw new Error('Smoke: rooms are not part of the core flows')
    },
    usage: async () => {
      throw new Error('Smoke: usage is not part of the core flows')
    },
    sendBotMessage: async () => {
      throw new Error('Smoke: bot chat is not part of the core flows')
    },
    botReplies: async () => {
      throw new Error('Smoke: bot chat is not part of the core flows')
    }
  })
  const providers = engineProvidersBackend(engineAccess, {
    removeEndpointModel: async () => undefined,
    usageDays: async () => ({})
  })
  return {
    roster,
    chat: chatActions(engineChatBackend(engineAccess)),
    providers
  }
}

export function disconnectRenderer(): void {
  host.disconnect()
  vi.unstubAllGlobals()
}

/**
 * Creates a scratch bot the way the create form does, runs `body`, and always deletes it. It is
 * created on the engine's default model: the temp home has no provider until a flow adds one,
 * and the engine refuses to pin a model whose provider it cannot reach.
 */
export async function withScratchBot(
  renderer: Renderer,
  body: (profile: string) => Promise<void>
): Promise<void> {
  const name = `Smoke ${Date.now().toString(36)}`
  const look = { ...matchName(name), faces: true }
  let profile: string
  try {
    profile = await createBot(
      renderer.roster,
      { name, folder: null, model: null, look, purpose: null },
      useRoster.getState().snapshot.bots.map((bot) => bot.name)
    )
  } catch (error) {
    // The profile exists even though a later step failed: it goes too.
    if (error instanceof IncompleteBotError) await renderer.roster.deleteProfile(error.profile)
    throw error
  }
  try {
    await refreshRoster(renderer.roster)
    if (!useRoster.getState().snapshot.bots.some((bot) => bot.name === profile))
      throw new Error('the new bot is not on the roster')
    await body(profile)
  } catch (error) {
    // A failed delete must not hide why the flow failed.
    await renderer.roster.deleteProfile(profile).catch(() => undefined)
    throw error
  }
  await renderer.roster.deleteProfile(profile)
}

/**
 * Sends the prompt; the engine must accept it. It stores the message only once a turn runs, and
 * with no provider none does, so the stored message and its answer are the reply flow's to prove.
 */
export async function sendMessage(renderer: Renderer, profile: string): Promise<void> {
  const draft = { text: PROMPT, images: [], whenBusy: null, replaces: null }
  if (!(await renderer.chat.send(profile, draft)))
    throw new Error(
      `the send failed: ${useChat.getState().chats[profile]?.error?.key ?? 'unknown'}`
    )
  if (!useChat.getState().chats[profile]?.sessionId) throw new Error('the send opened no chat')
}

/**
 * Adds the endpoint on every bot, as the providers page does, then pins its model on the scratch
 * bot, as the create form does.
 */
export async function pinScratchModel(
  renderer: Renderer,
  profile: string,
  provider: ScratchProvider
): Promise<void> {
  const refused = await saveEndpoint(renderer.providers, {
    editing: null,
    name: SCRATCH_ENDPOINT,
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    models: [provider.model]
  })
  if (refused.length) throw new Error(`${refused.length} bot(s) refused the endpoint`)
  const endpoints = await renderer.providers.endpoints(profile)
  const endpoint = endpoints.find((item) => item.name === SCRATCH_ENDPOINT)
  if (!endpoint) throw new Error('the scratch bot has no copy of the endpoint')
  await confirmBotModel(renderer.roster, profile, { provider: endpoint.id, model: provider.model })
}

/** Waits for the bot's reply, as the chat reads it back. */
export function awaitReply(renderer: Renderer, profile: string): Promise<void> {
  return until(REPLY_TIMEOUT_MS, profile, 'no reply within the timeout', async () => {
    const replies = await renderer.chat.recent(profile, RECENT_LIMIT)
    return replies.some((text) => REPLY.test(text))
  })
}

async function until(
  timeoutMs: number,
  profile: string,
  failure: string,
  done: () => Promise<boolean>
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!(await done())) {
    if (Date.now() > deadline) throw new Error(`${failure} (${await chatDiagnosis(profile)})`)
    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
  }
}

// What the engine holds for the chat, so a failed flow says why. The caller scrubs the text.
async function chatDiagnosis(profile: string): Promise<string> {
  const sessionId = useChat.getState().chats[profile]?.sessionId
  if (!sessionId) return 'no chat'
  const search = new URLSearchParams({ profile, limit: String(RECENT_LIMIT), order: 'latest' })
  const [{ messages }, snapshot] = await Promise.all([
    engineAccess.http<{ messages: { role: string }[] }>({
      path: `/api/sessions/${encodeURIComponent(sessionId)}/messages?${search}`,
      profile
    }),
    engineAccess.request<ResumeSnapshot>(profile, 'session.resume', {
      session_id: sessionId,
      defer_history: true,
      omit_messages: true
    })
  ])
  const roles = messages.map((message) => message.role).join(',') || 'none'
  return `stored roles ${roles}; running ${String(snapshot.running)}; turn error ${snapshot.inflight?.error ?? 'none'}`
}
