import { safeStorage } from 'electron'
import log from 'electron-log'
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type Database from 'better-sqlite3'
import type { SettingsStore } from '../storage/SettingsStore'
import type { OfficeSnapshot } from '../../../shared/office'
import { RosterRepo } from '../../domain/office/repository/RosterRepo'
import { SignalRepo } from '../../domain/office/repository/SignalRepo'
import { seedAgroOps } from '../../domain/office/seedAgroOps'
import { parseBotEvent, parseT3ListenEvent } from '../../domain/office/parseEvents'
import { RecordSignal } from '../../domain/office/useCases/RecordSignal'
import { GetOfficeSnapshot } from '../../domain/office/useCases/GetOfficeSnapshot'
import { GiveTask } from '../../domain/office/useCases/GiveTask'
import { SendToThread } from '../../domain/office/useCases/SendToThread'
import { CreateProject } from '../../domain/office/useCases/CreateProject'
import { SaveGroup } from '../../domain/office/useCases/SaveGroup'
import { DeleteBot } from '../../domain/office/useCases/DeleteBot'
import { SetWebhookKey } from '../../domain/office/useCases/SetWebhookKey'
import { GetBotInstructions } from '../../domain/office/useCases/GetBotInstructions'
import { SetFunnel } from '../../domain/office/useCases/SetFunnel'
import { T3Watcher } from '../../domain/office/services/T3Watcher'
import { SecretStore } from './SecretStore'
import { InboundServer } from './InboundServer'
import { FunnelControl, type FunnelStatus } from './FunnelControl'
import { T3Cli } from './T3Cli'
import { WebhookClient } from './WebhookClient'
import { T3Projects } from './T3Projects'
import { LogoStore } from './LogoStore'
import { INBOUND_TOKEN, ensureInboundToken } from './inboundToken'
import { registerOfficeIpc } from '../ipc/office.ipc'
import { registerRosterIpc } from '../ipc/roster.ipc'

const INBOUND_PORT = 47321
const T3_POLL_MS = 5000
const STALENESS_PUSH_MS = 60_000
const PUSH_DEBOUNCE_MS = 150
const FUNNEL_OFF_BUDGET_MS = 2000
const T3_BIN = join(homedir(), '.t3/bin/t3')
const T3_STATE_DB = join(homedir(), '.t3/userdata/statev2.sqlite')
const T3_TIMEOUT_MS = 30_000
const TAILSCALE_TIMEOUT_MS = 10_000
const MAX_OUTPUT_BYTES = 8 * 1024 * 1024
// A Finder-launched app has no /usr/local/bin on PATH.
const TAILSCALE_BIN =
  ['/usr/local/bin/tailscale', '/Applications/Tailscale.app/Contents/MacOS/Tailscale'].find(
    existsSync
  ) ?? 'tailscale'

export interface OfficeDeps {
  db: Database.Database
  settings: SettingsStore
  userDataDir: string
  broadcast: (channel: string, snapshot: OfficeSnapshot) => void
}

export interface RunningOffice {
  stop: () => Promise<void>
}

/** Composition root for Talyx Office: repositories, inputs, IPC and the push loop. */
export async function startOffice({
  db,
  settings,
  userDataDir,
  broadcast
}: OfficeDeps): Promise<RunningOffice> {
  const now = (): Date => new Date()
  const roster = new RosterRepo(db)
  const signals = new SignalRepo(db)
  seedAgroOps(roster)
  const secrets = new SecretStore(userDataDir, {
    encrypt: (s) => safeStorage.encryptString(s),
    decrypt: (b) => safeStorage.decryptString(b)
  })
  ensureInboundToken(secrets)

  let pushTimer: NodeJS.Timeout | null = null
  const schedulePush = (): void => {
    if (pushTimer) return
    pushTimer = setTimeout(() => {
      pushTimer = null
      pushCurrentProject()
    }, PUSH_DEBOUNCE_MS)
  }

  const record = new RecordSignal({ signals, roster, onChange: schedulePush })
  const t3 = new T3Cli((args, input) => run(T3_BIN, args, input, T3_TIMEOUT_MS))
  const watcher = new T3Watcher({ cli: t3, roster, signals, record, now })
  const funnelControl = new FunnelControl((args) =>
    run(TAILSCALE_BIN, args, undefined, TAILSCALE_TIMEOUT_MS)
  )
  let funnelState: FunnelStatus = { on: false, url: null }
  const t3Projects = new T3Projects(T3_STATE_DB)
  const logos = new LogoStore(userDataDir)

  const snapshot = new GetOfficeSnapshot({
    roster,
    signals,
    secrets,
    currentProjectId: () => settings.get().currentProjectId,
    staleMinutes: () => settings.get().staleMinutes,
    t3Connected: () => watcher.connected(),
    t3Projects: () => t3Projects.list(),
    funnel: () => funnelState,
    logoDataUrl: (path) => logos.dataUrl(path),
    now
  })

  function pushCurrentProject(): void {
    try {
      broadcast('office:changed', snapshot.execute(null))
    } catch (err) {
      log.warn('[Office] snapshot push failed:', err instanceof Error ? err.name : 'unknown')
    }
  }

  async function refreshFunnel(): Promise<void> {
    try {
      funnelState = await funnelControl.status(INBOUND_PORT)
    } catch (err) {
      log.warn('[Office] tailscale funnel status failed:', errorName(err))
      funnelState = { on: false, url: null }
    }
    schedulePush()
  }

  const funnel = new SetFunnel({
    enable: () => funnelControl.enable(INBOUND_PORT),
    disable: () => funnelControl.disable(),
    saveEnabled: (on) => void settings.update({ funnelEnabled: on }),
    refresh: refreshFunnel
  })
  const setFunnel = (on: boolean): Promise<void> => funnel.execute(on)

  const inbound = new InboundServer({
    port: INBOUND_PORT,
    token: () => secrets.get(INBOUND_TOKEN) ?? '',
    onBotEvent: (body) => {
      const groups = roster.listProjects().flatMap((p) => roster.listGroups(p.id))
      record.execute(parseBotEvent(body, { bots: roster.allBots(), groups, now: now() }))
    },
    onT3Event: (body) => {
      const signal = parseT3ListenEvent(body, {
        threadOwner: (id) => signals.threadOwner(id),
        now: now()
      })
      if (signal) record.execute(signal)
    }
  })

  registerOfficeIpc({
    snapshot,
    giveTask: new GiveTask({
      roster,
      secrets,
      webhook: new WebhookClient(fetch),
      t3,
      record,
      eventsUrl: () => funnelState.url,
      newRunId: randomUUID,
      now
    }),
    sendToThread: new SendToThread({ t3, signals })
  })
  registerRosterIpc({
    roster,
    createProject: new CreateProject({ roster, logos }),
    saveGroup: new SaveGroup({ roster }),
    deleteBot: new DeleteBot({ roster, secrets, signals }),
    setWebhookKey: new SetWebhookKey({ roster, secrets }),
    botInstructions: new GetBotInstructions({ roster, funnelUrl: () => funnelState.url }),
    t3Projects,
    secrets,
    funnel: { status: () => funnelState, set: setFunnel },
    changed: schedulePush
  })

  try {
    await inbound.start()
  } catch (err) {
    log.error('[Office] inbound endpoint did not start:', errorName(err))
  }
  watcher.start(T3_POLL_MS)
  const stalenessTimer = setInterval(schedulePush, STALENESS_PUSH_MS)
  const funnelReady = (settings.get().funnelEnabled ? setFunnel(true) : refreshFunnel()).catch(
    (err) => log.warn('[Office] tailscale funnel did not start:', errorName(err))
  )

  return {
    stop: async () => {
      clearInterval(stalenessTimer)
      if (pushTimer) clearTimeout(pushTimer)
      watcher.stop()
      // Turn the public URL off on quit, but never hold the quit hostage to tailscale.
      const funnelOff = funnelReady
        .then(() => (funnelState.on ? funnelControl.disable() : undefined))
        .catch((err) => log.warn('[Office] tailscale funnel off failed:', errorName(err)))
      await Promise.all([inbound.stop(), withBudget(funnelOff)])
    }
  }
}

function run(
  file: string,
  args: string[],
  input: string | undefined,
  timeout: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(file, args, { timeout, maxBuffer: MAX_OUTPUT_BYTES }, (err, stdout) =>
      err ? reject(err) : resolve(stdout)
    )
    child.stdin?.end(input ?? '')
  })
}

function withBudget(p: Promise<void>): Promise<void> {
  return Promise.race([p, new Promise<void>((r) => setTimeout(r, FUNNEL_OFF_BUDGET_MS))])
}

const errorName = (err: unknown): string => (err instanceof Error ? err.name : 'unknown')
