#!/usr/bin/env node
// control-talyx: starts a throwaway dev Talyx and drives its real Electron window over the
// Chrome DevTools Protocol. Usage is in SKILL.md next to this file.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const ROOT = process.env.TALYX_VERIFY_ROOT ?? '/tmp/talyx-verify'
const RUN = join(ROOT, 'run')
const EVIDENCE = join(ROOT, 'evidence')
const PID_FILE = join(RUN, 'pid')
const LOG_FILE = join(RUN, 'talyx.log')
const USER_DATA = join(RUN, 'userData')
const HOME = join(RUN, 'home')
const CDP_PORT = Number(process.env.TALYX_VERIFY_CDP_PORT ?? 9333)
const CDP_URL = `http://127.0.0.1:${CDP_PORT}`
const BRIDGE_PORT = Number(process.env.TALYX_VERIFY_BRIDGE_PORT ?? 5195)
const MCP_PORT = Number(process.env.TALYX_VERIFY_MCP_PORT ?? 47899)
const READY_TIMEOUT_MS = 90_000
const STEP_TIMEOUT_MS = 10_000
const STOP_TIMEOUT_MS = 10_000
const ENGINE_COMMAND = 'talyx-engine'

const [command, ...rest] = process.argv.slice(2)
const flags = parseFlags(rest)

const commands = {
  launch,
  doctor,
  stop,
  settings: showSettings,
  browser: browserCommand
}

async function launch() {
  const running = readPid()
  if (running && groupAlive(running))
    throw new Error(`A verification Talyx is already running (pid ${running}). Run stop first.`)
  rmSync(RUN, { recursive: true, force: true })
  mkdirSync(USER_DATA, { recursive: true })
  mkdirSync(HOME, { recursive: true })
  if (flags.seed) writeFileSync(join(USER_DATA, 'settings.json'), readFileSync(flags.seed))
  const env = {
    ...process.env,
    TALYX_BRIDGE_PORT: String(BRIDGE_PORT),
    TALYX_MCP_PORT: String(MCP_PORT)
  }
  if (flags['no-engine']) {
    env.HOME = HOME
    env.PATH = pathWithout(ENGINE_COMMAND, process.env.PATH ?? '')
  }
  const log = writeStream(LOG_FILE)
  const child = spawn(
    join(REPO, 'node_modules/.bin/electron-vite'),
    ['dev', '--', `--user-data-dir=${USER_DATA}`, `--remote-debugging-port=${CDP_PORT}`],
    { cwd: REPO, env, detached: true, stdio: ['ignore', log, log] }
  )
  child.unref()
  writeFileSync(PID_FILE, String(child.pid))
  let page = await waitForWindow(READY_TIMEOUT_MS)
  await page.context().browser().close()
  // The first dev build can reload the renderer once more; wait it out so a drive does not race it.
  await sleep(3000)
  page = await waitForWindow(READY_TIMEOUT_MS)
  console.log(
    `launched pid ${child.pid}, window "${await page.title()}", userData ${USER_DATA}${flags['no-engine'] ? ', engine hidden' : ', real engine'}`
  )
  await page.context().browser().close()
}

// An engine installed by setup in a --no-engine run lives in the run's HOME, and its gateway
// outlives Talyx (Talyx never owns the gateway), so stop it before the run directory goes.
function stopSandboxEngine() {
  const engine = join(HOME, '.local/bin', ENGINE_COMMAND)
  if (!existsSync(engine)) return
  spawnSync(engine, ['gateway', 'stop'], {
    env: { ...process.env, HOME, PATH: '/usr/bin:/bin' },
    stdio: 'ignore',
    timeout: STOP_TIMEOUT_MS
  })
  // Anything still running from inside the run directory is this run's; stop it by that path.
  spawnSync('pkill', ['-f', RUN])
}

async function doctor() {
  const problems = []
  if (!pidAlive()) problems.push(`no live pid in ${PID_FILE}`)
  let version = null
  try {
    version = await (await fetch(`${CDP_URL}/json/version`)).json()
  } catch {
    problems.push(`CDP not answering at ${CDP_URL}`)
  }
  if (!existsSync(USER_DATA)) problems.push(`no run directory at ${USER_DATA}`)
  if (problems.length) throw new Error(`not healthy: ${problems.join('; ')}`)
  const page = await mainPage()
  console.log(
    `ok pid ${readPid()}, ${version.Browser}, window "${await page.title()}", userData ${USER_DATA}`
  )
  await page.context().browser().close()
}

async function stop() {
  const pid = readPid()
  // Electron outlives electron-vite (the group leader) while it quits, so wait for the group.
  if (pid && groupAlive(pid)) {
    process.kill(-pid, 'SIGTERM')
    if (!(await groupGone(pid, STOP_TIMEOUT_MS))) {
      process.kill(-pid, 'SIGKILL')
      if (!(await groupGone(pid, STOP_TIMEOUT_MS)))
        throw new Error(`process group ${pid} survived SIGKILL; ${RUN} kept`)
    }
  }
  stopSandboxEngine()
  rmSync(RUN, { recursive: true, force: true })
  console.log(`stopped${pid ? ` pid ${pid}` : ''}; evidence kept in ${EVIDENCE}`)
}

function showSettings() {
  console.log(readFileSync(join(USER_DATA, 'settings.json'), 'utf8'))
}

async function browserCommand() {
  const [action, ...args] = rest
  const options = parseFlags(args)
  const act = browserActions[action] ?? unknownAction(action)
  const page = await mainPage()
  try {
    await act(page, options)
  } finally {
    await page.context().browser().close()
  }
}

const browserActions = {
  async click(page, o) {
    await locate(page, o).click({ timeout: STEP_TIMEOUT_MS })
    console.log(`clicked ${o.role} "${o.name}"`)
  },
  async fill(page, o) {
    await locate(page, o).fill(o.value ?? '', { timeout: STEP_TIMEOUT_MS })
    console.log(`filled ${o.role} "${o.name}"`)
  },
  async select(page, o) {
    await locate(page, o).selectOption({ label: o.value ?? '' }, { timeout: STEP_TIMEOUT_MS })
    console.log(`selected "${o.value}" in ${o.role} "${o.name}"`)
  },
  async press(page, o) {
    await page.keyboard.press(o.key)
    console.log(`pressed ${o.key}`)
  },
  async wait(page, o) {
    await locate(page, o).waitFor({
      state: 'visible',
      timeout: Number(o.timeout ?? STEP_TIMEOUT_MS)
    })
    console.log(`visible: ${o.role} "${o.name}"`)
  },
  async snapshot(page, o) {
    const aria = await page.locator('body').ariaSnapshot()
    if (o.path) save(o.path, aria)
    else console.log(aria)
  },
  async screenshot(page, o) {
    const path = o.path ?? join(EVIDENCE, 'screenshot.png')
    mkdirSync(dirname(path), { recursive: true })
    await page.screenshot({ path })
    console.log(`saved ${path}`)
  }
}

function unknownAction(action) {
  throw new Error(
    `Unknown browser action "${action ?? ''}". Actions: ${Object.keys(browserActions).join(', ')}`
  )
}

function locate(page, o) {
  if (!o.role || !o.name) throw new Error('--role and --name are required')
  return page.getByRole(o.role, { name: o.name, exact: o.exact !== undefined }).first()
}

function save(path, text) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text)
  console.log(`saved ${path}`)
}

async function waitForWindow(timeoutMs) {
  const until = Date.now() + timeoutMs
  while (Date.now() < until) {
    if (!pidAlive()) throw new Error(`Talyx exited during launch; see ${LOG_FILE}`)
    try {
      const page = await mainPage()
      await page.waitForLoadState('domcontentloaded')
      // The main window is ready once the splash has closed and the app has decided what to show.
      await page.locator('h1, h2, [aria-label="Roster"]').first().waitFor({ timeout: 2000 })
      return page
    } catch {
      await sleep(1000)
    }
  }
  throw new Error(`Talyx did not open a window within ${timeoutMs / 1000}s; see ${LOG_FILE}`)
}

async function mainPage() {
  const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 5000 })
  const pages = browser.contexts().flatMap((context) => context.pages())
  const page = pages.find((candidate) => !candidate.url().includes('splash'))
  if (!page) {
    await browser.close()
    throw new Error('no main window yet')
  }
  return page
}

function readPid() {
  return existsSync(PID_FILE) ? Number(readFileSync(PID_FILE, 'utf8')) : null
}

function pidAlive() {
  const pid = readPid()
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function groupAlive(pid) {
  try {
    process.kill(-pid, 0)
    return true
  } catch {
    return false
  }
}

async function groupGone(pid, ms) {
  for (const deadline = Date.now() + ms; Date.now() < deadline; await sleep(200)) {
    if (!groupAlive(pid)) return true
  }
  return !groupAlive(pid)
}

function pathWithout(executable, path) {
  return path
    .split(':')
    .filter((dir) => dir && !existsSync(join(dir, executable)))
    .join(':')
}

function writeStream(path) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, '')
  return openSync(path, 'a')
}

function parseFlags(args) {
  const out = {}
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (!arg.startsWith('--')) continue
    const key = arg.slice(2)
    const next = args[i + 1]
    if (next !== undefined && !next.startsWith('--')) {
      out[key] = next
      i++
    } else out[key] = true
  }
  return out
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const run = commands[command]
if (!run) {
  console.error(`Unknown command "${command ?? ''}". Commands: ${Object.keys(commands).join(', ')}`)
  process.exit(2)
}
try {
  await run()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
