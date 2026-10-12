import { app, ipcMain, shell, type BrowserWindow } from 'electron'
import log from 'electron-log'
import { randomUUID } from 'crypto'
import { homedir } from 'os'
import { join } from 'path'
import { z } from 'zod/v4'
import { validateInput } from './validation'
import { shouldCloseOverlayAfterAbort } from './overlayAfterAbort'
import { isSafeExternalUrl } from '../security/webContentsGuard'
import {
  AgentSession,
  type ApprovalDecision,
  type OverlayEvent,
  type SessionUi
} from '../../domain/agent/AgentSession'
import type { Brain } from '../../domain/agent/Brain'
import type { ConversationEntry } from '../../domain/conversation/model/Conversation'
import type { ConversationRepo } from '../../domain/conversation/repository/ConversationRepo'
import type { ConversationRecorder } from '../../domain/conversation/services/ConversationRecorder'
import type { CapabilityRegistry } from '../../domain/instruction/model/CapabilityRegistry'
import type { ModelOption } from '../../domain/agent/ModelProvider'
import {
  AnthropicProvider,
  API_KEY_MODELS,
  isApiKeyModel,
  type AssistantModel
} from '../ai-providers/AnthropicProvider'
import { ApiKeyStore } from '../agent/ApiKeyStore'
import type { ActionLogRepo } from '../agent/ActionLogRepo'
import { CaptureLogRepo } from '../../domain/capture/CaptureLogRepo'
import { runCapture, type CaptureClaude } from '../../domain/capture/CaptureRunner'
import type { CaptureDestination } from '../../domain/capture/CaptureTypes'
import { hideOverlayAndMaybePauseNotices } from '../../domain/briefing/model/noticePause'
import { findOwnersClaude } from './resolveSorter'
import { buildSystemPrompt, localNow } from '../agent/systemPrompt'
import {
  CLI_DEFAULT_MODEL,
  ClaudeCodeBrain,
  readClaudeCodeModels,
  testClaudeCodeSignIn
} from '../brains/ClaudeCodeBrain'
import { findInstalledClaudeCode, readClaudeCodeVersion } from '../brains/findClaudeCode'
import {
  INSTALL_COMMAND,
  installClaudeCode,
  readAuthStatus,
  startLogin,
  type ClaudeCodeAuth
} from '../brains/claudeCodeSetup'
import type { SettingsStore, UserSettings } from '../storage/SettingsStore'
import {
  AgentAbortedError,
  ClaudeCodeNotFoundError,
  MissingApiKeyError,
  ReplyTruncatedError
} from '../../domain/agent/errors'

export interface AgentStatus {
  hasApiKey: boolean
  /** Always one of `models`, so the picker never shows a stale id. */
  model: string
  /** What the selected brain can run: fixed for an API key, asked of the Claude Code binary. */
  models: ModelOption[]
  projectsRoot: string
  /** False for people who do not code; the Ask page hides the developer chips. */
  hasProjects: boolean
  busy: boolean
  provider: UserSettings['assistantProvider']
  claudeCode: {
    found: boolean
    path: string | null
    version: string | null
    /** Asked of the CLI, so Settings can say "signed in as" without a model turn. */
    auth: ClaudeCodeAuth
  }
  /** Shown before the installer runs, so nothing is piped to a shell unseen. */
  installCommand: string
}

const SIGNED_OUT: ClaudeCodeAuth = { loggedIn: false, email: null, plan: null }
const AUTH_CACHE_MS = 5000

const decisionSchema = z.object({ decision: z.enum(['approve', 'rest', 'deny']) })
const keySchema = z.object({ key: z.string().min(10) })

export function registerAgentIpc(deps: {
  registry: CapabilityRegistry
  /** Fixed at startup with the registry, so the chips match the registered abilities. */
  hasProjects: boolean
  actionLog: ActionLogRepo
  captureLog: CaptureLogRepo
  apiKeyStore: ApiKeyStore
  settingsStore: SettingsStore
  conversations: ConversationRepo
  recorder: ConversationRecorder
  narrator: { observe: (event: OverlayEvent) => void; stop: () => void } | null
  windows: {
    overlay: () => BrowserWindow | null
    main: () => BrowserWindow | null
    showOverlay: (options?: { exclusive?: boolean }) => void
    /** Raises the overlay only when no main window can show the card. */
    showOverlayForApproval: () => void
    hideOverlay: () => void
    hideOverlayWindowOnly: () => void
    fitOverlayHeight: (height: number) => void
    setApprovalPending: (pending: boolean) => void
  }
  quietBriefingVisible: () => boolean
  pauseNoticesForToday: () => void
  broadcast: (channel: string, payload: unknown) => void
}): {
  abort: () => void
  /** Shows events Talyx raised itself, without recording them as a conversation. */
  push: (events: OverlayEvent[]) => void
  /** Mid-run or holding an approval — nothing may talk over that. */
  busy: () => boolean
  /** Starts a run Talyx asked for itself, in a conversation of its own. */
  runAlone: (instruction: string) => void
} {
  let brain: Brain | null = null
  /** Provider + binary path the live brain was built for. The model is read per run. */
  let brainKey: string | null = null
  /** Handed to the next brain that is built, so reopening survives a provider switch. */
  let pendingResume: ConversationEntry[] | null = null
  let busy = false
  let resolveApproval: ((d: ApprovalDecision) => void) | null = null
  /** True after the brain hides the overlay mid-run (e.g. post-approval). */
  let overlayHiddenByAgent = false
  /** Aborts an in-flight capture:dump (routing or execute). */
  let captureAbort: AbortController | null = null
  const versionByPath = new Map<string, string | null>()
  const modelsByPath = new Map<string, ModelOption[]>()
  /** At most one sign-in at a time; a second would fight the first for the callback. */
  let login: ReturnType<typeof startLogin> | null = null
  const authByPath = new Map<string, { auth: ClaudeCodeAuth; at: number }>()

  const projectsRoot = (): string =>
    deps.settingsStore.store.projectsRoot ?? join(homedir(), 'Code')

  /** Claude Code and its model catalog must start somewhere that exists. */
  const workingDir = (): string => (deps.hasProjects ? projectsRoot() : homedir())

  const claudeCodePath = (settings: UserSettings): string | null =>
    findInstalledClaudeCode(settings.claudeCodePath, homedir())

  const keyFor = (settings: UserSettings): string =>
    `${settings.assistantProvider}:${claudeCodePath(settings) ?? ''}`

  /** A Claude Code alias left over from the other brain must not reach the Messages API. */
  const apiKeyModel = (): AssistantModel => {
    const stored = deps.settingsStore.store.assistantModel
    return isApiKeyModel(stored) ? stored : API_KEY_MODELS[0].id
  }

  /** An API-key id left over from the other brain must not reach the CLI either. */
  const claudeCodeModel = (path: string): string => {
    const stored = deps.settingsStore.store.assistantModel
    const catalog = modelsByPath.get(path)
    return !catalog || catalog.some((m) => m.id === stored) ? stored : CLI_DEFAULT_MODEL
  }

  /** Everything an event reaches except the conversation record. */
  function fanOut(event: OverlayEvent): void {
    // After approval the brain hides the overlay so computer-use can focus the
    // desktop; bring it back when the turn finishes so the owner sees the reply.
    if (overlayHiddenByAgent && (event.type === 'done' || event.type === 'error')) {
      overlayHiddenByAgent = false
      deps.windows.showOverlay()
    }
    deps.narrator?.observe(event)
    for (const win of [deps.windows.overlay(), deps.windows.main()]) {
      if (win && !win.isDestroyed()) win.webContents.send('agent:event', event)
    }
    deps.broadcast('agent:event', event)
  }

  function send(event: OverlayEvent): void {
    deps.recorder.observe(event)
    fanOut(event)
  }

  const ui: SessionUi = {
    approve: (request) =>
      new Promise<ApprovalDecision>((resolve) => {
        resolveApproval = resolve
        deps.windows.setApprovalPending(true)
        overlayHiddenByAgent = false
        deps.windows.showOverlayForApproval()
        send({ type: 'approval', request })
      }).finally(() => {
        resolveApproval = null
        deps.windows.setApprovalPending(false)
      }),
    hide: () => {
      // Only an overlay that was up needs bringing back at the end of the turn;
      // an Ask-page approval never showed it and must not summon it either.
      const overlay = deps.windows.overlay()
      overlayHiddenByAgent = !!overlay && !overlay.isDestroyed() && overlay.isVisible()
      deps.windows.hideOverlay()
    }
  }

  function ensureBrain(): Brain {
    const settings = deps.settingsStore.store
    // The provider and binary are fixed when a brain is built, so a Settings
    // change only reaches the user by starting over.
    if (brain && brainKey !== keyFor(settings)) brain = null
    if (!brain) {
      brain =
        settings.assistantProvider === 'claude-code'
          ? buildClaudeCodeBrain(settings)
          : buildApiKeyBrain()
      brainKey = keyFor(settings)
    }
    // Applied on both the freshly-built and the cached path, so a reopen
    // is never silently dropped just because a brain happened to survive.
    if (pendingResume !== null) {
      brain.resume?.(pendingResume)
      pendingResume = null
    }
    return brain
  }

  function buildApiKeyBrain(): Brain {
    const provider = new AnthropicProvider(deps.apiKeyStore.read(), apiKeyModel, () =>
      buildSystemPrompt({
        home: homedir(),
        projectsRoot: deps.hasProjects ? projectsRoot() : null,
        platform: process.platform,
        now: localNow()
      })
    )
    return new AgentSession(provider, deps.registry, ui, deps.actionLog, send, {
      sessionId: randomUUID(),
      home: homedir(),
      projectsRoot: projectsRoot()
    })
  }

  function buildClaudeCodeBrain(settings: UserSettings): Brain {
    const path = claudeCodePath(settings)
    if (!path) throw new ClaudeCodeNotFoundError()
    return new ClaudeCodeBrain({
      registry: deps.registry,
      ui,
      log: deps.actionLog,
      emit: send,
      options: {
        sessionId: randomUUID(),
        home: homedir(),
        projectsRoot: projectsRoot(),
        claudeCodePath: path,
        model: () => claudeCodeModel(path)
      },
      logger: { info: (m) => log.info(m), warn: (m) => log.warn(m) }
    })
  }

  function abort(): void {
    deps.narrator?.stop()
    // Brain.abort() rejects its own internal wrapper, not the approve()
    // promise this module handed it — that one only settles via agent:approve,
    // so its .finally would never run and leave the overlay stuck "pending".
    const hadPendingApproval = resolveApproval !== null
    resolveApproval?.('deny')
    resolveApproval = null
    deps.windows.setApprovalPending(false)
    if (shouldCloseOverlayAfterAbort(hadPendingApproval, deps.windows.overlay())) {
      deps.windows.hideOverlayWindowOnly()
    }
    captureAbort?.abort()
    captureAbort = null
    brain?.abort()
    // An aborted controller stays aborted: reusing this brain would kill the
    // next run before it started.
    brain = null
  }

  /**
   * Every window focus asks for the status, and asking the CLI costs a process
   * spawn, so a burst of them reuses one answer. Short enough that signing out
   * elsewhere shows up almost at once.
   */
  async function cachedAuth(path: string): Promise<ClaudeCodeAuth> {
    const fresh = authByPath.get(path)
    if (fresh && Date.now() - fresh.at < AUTH_CACHE_MS) return fresh.auth
    const auth = await readAuthStatus(path)
    authByPath.set(path, { auth, at: Date.now() })
    return auth
  }

  async function claudeCodeStatus(settings: UserSettings): Promise<AgentStatus['claudeCode']> {
    const path = claudeCodePath(settings)
    if (!path) {
      return { found: false, path: null, version: null, auth: SIGNED_OUT }
    }
    let version = versionByPath.get(path) ?? null
    if (version === null) {
      version = await readClaudeCodeVersion(path)
      if (version !== null) versionByPath.set(path, version)
    }
    return { found: true, path, version, auth: await cachedAuth(path) }
  }

  async function claudeCodeModels(settings: UserSettings): Promise<ModelOption[]> {
    const path = claudeCodePath(settings)
    if (!path) return []
    const cached = modelsByPath.get(path)
    if (cached) return cached
    try {
      const models = await readClaudeCodeModels({ claudeCodePath: path, cwd: workingDir() })
      modelsByPath.set(path, models)
      return models
    } catch (err) {
      log.warn(`[agent] could not read Claude Code models: ${(err as Error).message}`)
      return []
    }
  }

  async function models(settings: UserSettings): Promise<ModelOption[]> {
    return settings.assistantProvider === 'claude-code'
      ? claudeCodeModels(settings)
      : [...API_KEY_MODELS]
  }

  ipcMain.handle('agent:status', async (): Promise<AgentStatus> => {
    const settings = deps.settingsStore.store
    const options = await models(settings)
    const stored = settings.assistantModel
    return {
      hasApiKey: deps.apiKeyStore.has(),
      model: options.some((m) => m.id === stored) ? stored : (options[0]?.id ?? stored),
      models: options,
      projectsRoot: projectsRoot(),
      hasProjects: deps.hasProjects,
      busy,
      provider: settings.assistantProvider,
      claudeCode: await claudeCodeStatus(settings),
      installCommand: INSTALL_COMMAND
    }
  })

  function startRun(instruction: string): { started: true } {
    const settings = deps.settingsStore.store
    if (settings.assistantProvider === 'api-key' && !deps.apiKeyStore.has()) {
      throw new MissingApiKeyError()
    }
    if (busy) throw new Error('The assistant is still working on the previous request')
    busy = true
    let current: Brain
    try {
      current = ensureBrain()
    } catch (err) {
      busy = false
      throw err
    }
    deps.recorder.startedBy(instruction)
    void current
      .run(instruction)
      .catch((err: Error & { key?: string }) => {
        log.warn(`[agent] run failed: ${err.name}: ${err.message}`)
        send({ type: 'error', key: err.key ?? 'agent_failed', message: err.message })
        send({ type: 'done' })
        // Only a dead brain is discarded; a provider hiccup must keep the
        // transcript so the user can just ask again.
        if (err instanceof ReplyTruncatedError || err instanceof AgentAbortedError) brain = null
      })
      .finally(() => {
        busy = false
      })
    return { started: true }
  }

  ipcMain.handle('agent:run', async (_event, raw: unknown) => {
    const { instruction } = validateInput(z.object({ instruction: z.string().min(1) }), raw)
    return startRun(instruction)
  })

  const chipSchema = z.enum(['note', 'reminder', 'calendar', 'file']).nullable()

  function findCaptureClaude(): CaptureClaude | null {
    let apiKey: string | null = null
    try {
      apiKey = deps.apiKeyStore.has() ? deps.apiKeyStore.read() : null
    } catch {
      apiKey = null
    }
    const owners = findOwnersClaude({ settings: deps.settingsStore.store, apiKey })
    if (!owners) return null
    return {
      complete: async (messages, signal) => {
        const reply = await owners.provider.complete(messages, [], signal)
        return { text: reply.text }
      }
    }
  }

  function startDump(text: string, chip: CaptureDestination | null): { started: true } {
    if (busy) throw new Error('The assistant is still working on the previous request')
    busy = true
    const abortCtl = new AbortController()
    captureAbort = abortCtl
    deps.windows.showOverlay({ exclusive: true })
    // Capture is not an Ask turn — fanOut skips ConversationRecorder so an open
    // conversation is not polluted with dump status/text without a user message.
    fanOut({ type: 'status', state: 'working', label: 'Capturing…' })
    const approveCapture: typeof ui.approve = (request) =>
      new Promise<ApprovalDecision>((resolve) => {
        resolveApproval = resolve
        deps.windows.setApprovalPending(true)
        deps.windows.showOverlay({ exclusive: true })
        fanOut({ type: 'approval', request })
      }).finally(() => {
        resolveApproval = null
        deps.windows.setApprovalPending(false)
      })
    void runCapture(
      {
        registry: deps.registry,
        ctx: {
          home: homedir(),
          projectsRoot: projectsRoot(),
          signal: abortCtl.signal,
          logger: { info: (m) => log.info(m), warn: (m) => log.warn(m) }
        },
        log: deps.actionLog,
        emit: fanOut,
        sessionId: `capture-${randomUUID()}`,
        approve: approveCapture,
        captureLog: deps.captureLog,
        findClaude: findCaptureClaude,
        now: () => new Date()
      },
      { text, chip }
    )
      .catch((err: Error & { key?: string }) => {
        if (err instanceof AgentAbortedError || abortCtl.signal.aborted) return
        log.warn(`[capture] dump failed: ${err.name}: ${err.message}`)
        fanOut({ type: 'error', key: err.key ?? 'capture_failed', message: err.message })
      })
      .finally(() => {
        fanOut({ type: 'done' })
        if (captureAbort === abortCtl) captureAbort = null
        busy = false
      })
    return { started: true }
  }

  ipcMain.handle('capture:dump', async (_event, raw: unknown) => {
    const { text, chip } = validateInput(
      z.object({ text: z.string().min(1), chip: chipSchema.default(null) }),
      raw
    )
    return startDump(text, chip)
  })

  ipcMain.handle('agent:approve', (_event, raw: unknown) => {
    const { decision } = validateInput(decisionSchema, raw)
    resolveApproval?.(decision)
  })

  ipcMain.handle('agent:abort', () => abort())
  // New conversation: drop the model's transcript too, not just the renderer's
  ipcMain.handle('agent:reset', () => {
    deps.recorder.close()
    // A reopened conversation's replay must not follow the owner into the new one.
    pendingResume = null
    abort()
  })

  ipcMain.handle('conversation:list', () => deps.conversations.list())

  ipcMain.handle('conversation:open', async (_event, raw: unknown) => {
    const { id } = validateInput(z.object({ id: z.string().min(1) }), raw)
    if (busy) throw new Error('The assistant is still working on the previous request')
    const entries = deps.conversations.entries(id)
    // A brain built for the previous conversation would answer with its context.
    brain = null
    deps.recorder.reopen(id)
    pendingResume = entries
    return { entries }
  })

  ipcMain.handle('conversation:delete', async (_event, raw: unknown) => {
    const { id } = validateInput(z.object({ id: z.string().min(1) }), raw)
    deps.conversations.remove(id)
    if (deps.recorder.openId() === id) {
      deps.recorder.close()
      // The live brain still holds this conversation's turns, and a pending
      // resume still points at rows that are now gone. Deleting has to mean
      // the model forgets it too.
      brain = null
      pendingResume = null
    }
  })

  ipcMain.handle('conversation:delete-all', () => {
    deps.conversations.removeAll()
    deps.actionLog.removeAll()
    deps.recorder.close()
    brain = null
    pendingResume = null
  })
  ipcMain.handle('agent:hide', () => {
    hideOverlayAndMaybePauseNotices({
      quietBriefingVisible: deps.quietBriefingVisible,
      hideOverlay: () => deps.windows.hideOverlay(),
      pauseNoticesForToday: deps.pauseNoticesForToday
    })
  })
  ipcMain.handle('agent:fit-overlay', (_event, raw: unknown) => {
    const { height } = validateInput(z.object({ height: z.number().positive().max(2000) }), raw)
    deps.windows.fitOverlayHeight(height)
  })
  ipcMain.handle('agent:open-settings', () => {
    // Show the main window first: hideOverlay() ends in app.hide() on darwin,
    // which would otherwise drop focus behind whatever app was active before.
    const main = deps.windows.main()
    if (main && !main.isDestroyed()) {
      main.show()
      main.focus()
      main.webContents.send('navigate', 'settings')
    }
    deps.windows.hideOverlayWindowOnly()
  })

  ipcMain.handle('claude-code:install', async () => {
    // The binary moves, so forget what was cached about the old one.
    versionByPath.clear()
    modelsByPath.clear()
    authByPath.clear()
    brain = null
    await installClaudeCode((line) => deps.broadcast('claude-code:install-progress', { line }))
    const path = claudeCodePath(deps.settingsStore.store)
    if (!path) throw new ClaudeCodeNotFoundError()
    return { path }
  })

  ipcMain.handle('claude-code:login', async () => {
    const path = claudeCodePath(deps.settingsStore.store)
    if (!path) throw new ClaudeCodeNotFoundError()
    login?.cancel()
    login = startLogin({
      claudeCodePath: path,
      cwd: workingDir(),
      // The flow finishes in a browser, so hand the page straight to one.
      onUrl: (url) => {
        if (isSafeExternalUrl(url)) void shell.openExternal(url)
      }
    })
    const auth = await login.done
    login = null
    authByPath.set(path, { auth, at: Date.now() })
    // A brain built while signed out would keep failing.
    brain = null
    return auth
  })

  ipcMain.handle('claude-code:cancel-login', () => {
    login?.cancel()
    login = null
  })

  ipcMain.handle('agent:set-api-key', async (_event, raw: unknown) => {
    const { key } = validateInput(keySchema, raw)
    deps.apiKeyStore.write(key)
    brain = null
  })
  ipcMain.handle('agent:test-api-key', async (_event, raw: unknown) => {
    const { key } = validateInput(keySchema, raw)
    await AnthropicProvider.testKey(key)
  })
  ipcMain.handle('agent:clear-api-key', () => {
    deps.apiKeyStore.clear()
    brain = null
  })
  ipcMain.handle('agent:test-claude-code', async () => {
    const path = claudeCodePath(deps.settingsStore.store)
    if (!path) throw new ClaudeCodeNotFoundError()
    await testClaudeCodeSignIn({ claudeCodePath: path, cwd: workingDir() })
  })

  app.on('before-quit', () => {
    login?.cancel()
    abort()
  })
  return {
    abort,
    // Deliberately not `send`: a briefing the owner never asked for must not be
    // filed into whatever conversation happens to be open, where it would
    // replay into the model the next time that conversation is reopened.
    push: (events) => events.forEach(fanOut),
    // An approval card is up whenever there is a decision still to resolve.
    busy: () => busy || resolveApproval !== null,
    runAlone: (instruction) => {
      // Its own conversation, and its own brain. Continuing whatever the owner
      // last talked about would file the briefing there and answer it with that
      // context — the same leak `push` above deliberately avoids.
      deps.recorder.close()
      brain = null
      pendingResume = null
      void startRun(instruction)
    }
  }
}
