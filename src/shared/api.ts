// Single source of truth for the window.api surface. The preload builds it
// over ipcRenderer; the browser dev bridge builds it over HTTP+SSE. Must not
// import 'electron' — it compiles in both the node and web tsconfigs.
import type {
  Bot,
  ChatMessage,
  ConversationTarget,
  Group,
  OfficeGiveTaskInput,
  OfficeSnapshot,
  Project,
  Room,
  T3Project
} from './office'

export interface ApiTransport {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
  on: (channel: string, listener: (...args: unknown[]) => void) => () => void
  getPathForFile: (file: File) => string
}

// The return type is deliberately inferred — it IS the definition of TalyxApi
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function buildApi(transport: ApiTransport) {
  return {
    getSettings: () => transport.invoke('settings:get'),
    updateSettings: (patch: Record<string, unknown>) => transport.invoke('settings:set', patch),

    officeSnapshot: (projectId: string | null) =>
      transport.invoke('office:snapshot', projectId) as Promise<OfficeSnapshot>,
    onOfficeChanged: (cb: (snapshot: OfficeSnapshot) => void) =>
      transport.on('office:changed', (snapshot) => cb(snapshot as OfficeSnapshot)),
    officeGiveTask: (input: OfficeGiveTaskInput) =>
      transport.invoke('office:give-task', input) as Promise<void>,
    officeSendToThread: (input: { threadId: string; message: string }) =>
      transport.invoke('office:send-to-thread', input) as Promise<void>,
    officeOpenExternal: (url: string) =>
      transport.invoke('office:open-external', url) as Promise<void>,

    chatConversation: (target: ConversationTarget) =>
      transport.invoke('chat:conversation', target) as Promise<ChatMessage[]>,
    chatSendGroup: (input: { groupId: string; text: string }) =>
      transport.invoke('chat:send-group', input) as Promise<void>,
    chatSendDm: (input: { botId: string; text: string }) =>
      transport.invoke('chat:send-dm', input) as Promise<void>,

    rosterSaveProject: (project: Project) =>
      transport.invoke('roster:save-project', project) as Promise<void>,
    rosterSaveGroup: (group: Group) =>
      transport.invoke('roster:save-group', group) as Promise<void>,
    rosterSaveRoom: (room: Room) => transport.invoke('roster:save-room', room) as Promise<void>,
    rosterSaveBot: (bot: Bot) => transport.invoke('roster:save-bot', bot) as Promise<void>,
    rosterDeleteBot: (botId: string) =>
      transport.invoke('roster:delete-bot', botId) as Promise<void>,
    rosterSetWebhookKey: (input: { botId: string; key: string }) =>
      transport.invoke('roster:set-webhook-key', input) as Promise<void>,
    rosterT3Projects: () => transport.invoke('roster:t3-projects') as Promise<T3Project[]>,
    rosterBotInstructions: (botId: string) =>
      transport.invoke('roster:bot-instructions', { botId }) as Promise<string>,
    rosterPickLogo: () => transport.invoke('roster:pick-logo') as Promise<string | null>,
    rosterEndpoint: () =>
      transport.invoke('roster:endpoint') as Promise<{ url: string | null; tokenHint: string }>,
    rosterRevealToken: () => transport.invoke('roster:reveal-token') as Promise<string | null>,
    rosterRotateToken: () => transport.invoke('roster:rotate-token') as Promise<void>,
    rosterFunnel: (state: 'on' | 'off') => transport.invoke('roster:funnel', state) as Promise<void>
  }
}

export type TalyxApi = ReturnType<typeof buildApi>
