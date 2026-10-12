export type AgentDecision = 'approve' | 'rest' | 'deny'

export interface ApprovalProposal {
  id: string
  tool: string
  summary: string
  reversible: boolean
  operations: { label: string; reason: string }[]
}

export interface ApprovalRequest {
  text: string
  proposals: ApprovalProposal[]
}

export type ActivityState = 'thinking' | 'searching' | 'working' | 'waiting'
export interface ActivityStatus {
  state: ActivityState
  label: string
}

export interface PathEntry {
  path: string
  label: string
  snippet: string | null
  isDirectory: boolean
}
export interface CalendarEvent {
  title: string
  start: string
  end: string
  location: string | null
  calendar: string
  allDay: boolean
}
export interface MailMessage {
  from: string
  subject: string
  receivedAt: string
  preview: string
}
export type ResultCard =
  | { kind: 'mail'; messages: MailMessage[] }
  | { kind: 'paths'; entries: PathEntry[] }
  | { kind: 'disk'; freeBytes: number; totalBytes: number }
  | { kind: 'agenda'; day: 'today' | 'tomorrow' | 'week'; events: CalendarEvent[] }

export type AgentEvent =
  | { type: 'text'; text: string; interim: boolean }
  | { type: 'status'; state: ActivityState; label: string }
  | { type: 'card'; card: ResultCard }
  | { type: 'action'; label: string; ok: boolean; error: string | null }
  | { type: 'approval'; request: ApprovalRequest }
  | { type: 'done' }
  | { type: 'error'; key: string; message: string }

export type AssistantProvider = 'api-key' | 'claude-code'

export interface ModelOption {
  id: string
  label: string
  description: string
}

export interface AgentStatus {
  hasApiKey: boolean
  /** Always one of `models`. */
  model: string
  models: ModelOption[]
  projectsRoot: string
  hasProjects: boolean
  busy: boolean
  provider: AssistantProvider
  claudeCode: {
    found: boolean
    path: string | null
    version: string | null
    auth: ClaudeCodeAuth
  }
  /** The exact command the installer will run, shown before it does. */
  installCommand: string
}

export interface ClaudeCodeAuth {
  loggedIn: boolean
  email: string | null
  plan: string | null
}

/** Whether the selected brain can start a run right now. */
export function brainReady(status: AgentStatus): boolean {
  return status.provider === 'claude-code'
    ? status.claudeCode.found && status.claudeCode.auth.loggedIn
    : status.hasApiKey
}

export type CaptureDestination = 'note' | 'reminder' | 'calendar' | 'file'

export const agentApi = {
  run: (instruction: string): Promise<void> =>
    window.api.agentRun(instruction).then(() => undefined),
  dump: (text: string, chip: CaptureDestination | null = null): Promise<void> =>
    window.api.captureDump(text, chip).then(() => undefined),
  approve: (decision: AgentDecision): Promise<void> =>
    window.api.agentApprove(decision) as Promise<void>,
  abort: (): Promise<void> => window.api.agentAbort() as Promise<void>,
  reset: (): Promise<void> => window.api.agentReset() as Promise<void>,
  status: (): Promise<AgentStatus> => window.api.agentStatus() as Promise<AgentStatus>,
  hide: (): Promise<void> => window.api.agentHide() as Promise<void>,
  fitOverlay: (height: number): Promise<void> =>
    window.api.agentFitOverlay(height) as Promise<void>,
  openSettings: (): Promise<void> => window.api.agentOpenSettings() as Promise<void>,
  setApiKey: (key: string): Promise<void> => window.api.agentSetApiKey(key) as Promise<void>,
  testApiKey: (key: string): Promise<void> => window.api.agentTestApiKey(key) as Promise<void>,
  testClaudeCode: (): Promise<void> => window.api.agentTestClaudeCode() as Promise<void>,
  clearApiKey: (): Promise<void> => window.api.agentClearApiKey() as Promise<void>,
  installClaudeCode: (): Promise<{ path: string }> =>
    window.api.claudeCodeInstall() as Promise<{ path: string }>,
  loginClaudeCode: (): Promise<ClaudeCodeAuth> =>
    window.api.claudeCodeLogin() as Promise<ClaudeCodeAuth>,
  cancelClaudeCodeLogin: (): Promise<void> => window.api.claudeCodeCancelLogin() as Promise<void>,
  onInstallProgress: (callback: (line: string) => void): (() => void) =>
    window.api.onClaudeCodeInstallProgress(callback),
  onEvent: (callback: (event: AgentEvent) => void): (() => void) =>
    window.api.onAgentEvent((event) => callback(event as AgentEvent))
}
