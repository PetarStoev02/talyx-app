import type { AgentEvent } from '@shared/api/agent'

/**
 * A `window.api` good enough to render the real renderer in a browser tab.
 *
 * Only the handful of channels the Assistant view touches on mount have
 * fixtures; everything else falls through to the proxy below and answers
 * `undefined`, so a new IPC channel in the app degrades to a quiet no-op here
 * rather than a crash in the landing page.
 */

const noop = (): (() => void) => () => {}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

const SETTINGS = {
  theme: 'system',
  appLanguage: 'en',
  sidebarCollapsed: false,
  filesGroupOpen: true,
  hasSeenOnboarding: true,
  sorterSource: 'smart-local'
}

const WATCH_FOLDERS = [
  {
    id: 1,
    path: '/Users/you/Downloads',
    outputPath: '/Users/you/Documents',
    enabled: true,
    sortMode: 'move' as const,
    createdAt: daysAgo(30)
  }
]
const HISTORY = [
  {
    batchId: 'demo-walkthrough',
    timestamp: daysAgo(16),
    totalFiles: 5,
    undoneAt: null,
    operations: [
      {
        batchId: 'demo-walkthrough',
        sourcePath: '/Users/you/Downloads/talyx-walkthrough/notes.pdf',
        destPath: '/Users/you/Documents/Notes/notes.pdf',
        operationType: 'move' as const,
        category: 'Documents',
        subcategory: 'Notes',
        fileName: 'notes.pdf',
        fileSize: 24_000,
        createdAt: daysAgo(16)
      }
    ]
  },
  {
    batchId: 'demo-task7',
    timestamp: daysAgo(18),
    totalFiles: 3,
    undoneAt: daysAgo(18),
    operations: [
      {
        batchId: 'demo-task7',
        sourcePath: '/Users/you/Downloads/talyx-task7-test/invoice.pdf',
        destPath: '/Users/you/Documents/Invoices/invoice.pdf',
        operationType: 'move' as const,
        category: 'Documents',
        subcategory: 'Invoices',
        fileName: 'invoice.pdf',
        fileSize: 51_000,
        createdAt: daysAgo(18)
      }
    ]
  }
]

/** A scripted run, so the demo can answer without a model behind it. */
const SCRIPT: { after: number; event: AgentEvent }[] = [
  { after: 250, event: { type: 'status', state: 'thinking', label: 'Reading your calendar' } },
  {
    after: 1100,
    event: {
      type: 'approval',
      request: {
        text: 'Add “Dentist” to your calendar tomorrow at 16:00.',
        proposals: [
          {
            id: 'demo-1',
            tool: 'calendar.createEvent',
            summary: 'Create one event in Calendar',
            reversible: true,
            operations: [
              { label: 'Dentist — tomorrow 16:00–17:00', reason: 'The time you asked for' }
            ]
          }
        ]
      }
    }
  }
]

const AFTER_APPROVAL: { after: number; event: AgentEvent }[] = [
  { after: 200, event: { type: 'status', state: 'working', label: 'Adding the event' } },
  { after: 900, event: { type: 'action', label: 'Created “Dentist”', ok: true, error: null } },
  {
    after: 1100,
    event: { type: 'text', text: 'Added **Dentist** tomorrow at 16:00.', interim: false }
  },
  { after: 1200, event: { type: 'done' } }
]

const agentListeners = new Set<(event: AgentEvent) => void>()
const timers: ReturnType<typeof setTimeout>[] = []

function play(script: { after: number; event: AgentEvent }[]): void {
  for (const { after, event } of script) {
    timers.push(setTimeout(() => agentListeners.forEach((fn) => fn(event)), after))
  }
}

function stop(): void {
  while (timers.length) clearTimeout(timers.pop())
}

const fixtures: Record<string, (...args: never[]) => unknown> = {
  onAgentEvent: (callback: (event: AgentEvent) => void) => {
    agentListeners.add(callback)
    return () => agentListeners.delete(callback)
  },
  agentRun: () => {
    stop()
    play(SCRIPT)
    return Promise.resolve()
  },
  agentApprove: (decision: string) => {
    stop()
    play(
      decision === 'deny'
        ? [
            { after: 150, event: { type: 'text', text: 'Left it alone.', interim: false } },
            { after: 250, event: { type: 'done' } }
          ]
        : AFTER_APPROVAL
    )
    return Promise.resolve()
  },
  agentAbort: () => (stop(), Promise.resolve()),
  agentReset: () => (stop(), Promise.resolve()),
  agentStatus: () =>
    Promise.resolve({
      hasApiKey: true,
      model: 'claude-opus-4-6',
      models: [
        { id: 'claude-opus-4-6', label: 'Opus', description: '1M context' },
        { id: 'claude-sonnet-4-6', label: 'Sonnet', description: 'Faster' }
      ],
      projectsRoot: '/Users/you/Code',
      hasProjects: true,
      busy: false,
      provider: 'claude-code',
      claudeCode: {
        found: true,
        path: '/usr/local/bin/claude',
        version: '2.0.0',
        auth: { loggedIn: true, email: 'you@example.com', plan: 'Max' }
      },
      installCommand: 'npm i -g @anthropic-ai/claude-code'
    }),

  getSettings: () => Promise.resolve(SETTINGS),
  setSettings: (partial: Record<string, unknown>) =>
    Promise.resolve(Object.assign(SETTINGS, partial)),
  getHistory: (_opts?: { limit?: number; offset?: number }) => Promise.resolve(HISTORY),
  undoSort: (batchId: string) => {
    const batch = HISTORY.find((b) => b.batchId === batchId)
    if (batch && !batch.undoneAt) batch.undoneAt = new Date().toISOString()
    return Promise.resolve({ ok: true })
  },
  listWatchFolders: () => Promise.resolve([...WATCH_FOLDERS]),
  toggleWatchFolder: ({ id, enabled }: { id: number; enabled: boolean }) => {
    const folder = WATCH_FOLDERS.find((f) => f.id === id)
    if (folder) folder.enabled = enabled
    return Promise.resolve()
  },
  onWatchEvent: noop,
  previewSort: () => Promise.resolve([]),
  conversationList: () => Promise.resolve([]),
  conversationOpen: () => Promise.resolve({ entries: [] }),
  checkForUpdates: () => Promise.resolve({ status: 'up-to-date', version: null, url: null }),
  voicePermission: () => Promise.resolve({ granted: false }),
  voiceModelStatus: () =>
    Promise.resolve({ choice: 'fast', installed: false, needsAccurateForBulgarian: false }),
  voiceTtsStatus: () =>
    Promise.resolve({ engine: 'system', voice: 'system', modelInstalled: false, voices: [] })
}

/** Unstubbed reads resolve empty; unstubbed `on*` subscriptions unsubscribe cleanly. */
function fallback(name: string): (...args: unknown[]) => unknown {
  if (name.startsWith('on')) return noop
  return () => Promise.resolve(undefined)
}

export function installDemoApi(): void {
  const api = new Proxy({} as Record<string, unknown>, {
    get: (_target, prop: string) => fixtures[prop] ?? fallback(prop)
  })

  Object.defineProperty(window, 'api', { value: api, configurable: true })
  Object.defineProperty(window, 'electron', {
    value: { platform: 'darwin', ipcRenderer: { on: noop, send: noop, invoke: () => undefined } },
    configurable: true
  })
}
