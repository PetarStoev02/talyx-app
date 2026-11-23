#!/usr/bin/env node
// control-talyx: starts a throwaway dev Talyx and drives its real Electron window over the
// Chrome DevTools Protocol. Usage is in SKILL.md next to this file.
import { spawn, spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const ROOT = resolve(process.env.TALYX_VERIFY_ROOT ?? '/tmp/talyx-verify')
const RUN = join(ROOT, 'run')
const EVIDENCE = join(ROOT, 'evidence')
const PID_FILE = join(RUN, 'pid')
const MODE_FILE = join(RUN, 'mode')
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
  browser: browserCommand,
  fuzz
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
  writeFileSync(MODE_FILE, flags['no-engine'] ? 'no-engine' : 'engine')
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
// outlives Talyx (Talyx never owns the gateway). Stop what runs from inside the run directory, by
// that path (also by its real path, for a TALYX_VERIFY_ROOT behind a symlink). Not `gateway stop`:
// the engine looks for its launchd service under the account's real home, so it could stop the
// user's own gateway.
async function stopRunProcesses() {
  const signal = (name) =>
    pathsOf(RUN).forEach((path) => spawnSync('pkill', [`-${name}`, '-U', uid(), '-f', `${path}/`]))
  const gone = async () => {
    for (const deadline = Date.now() + STOP_TIMEOUT_MS; Date.now() < deadline; await sleep(200))
      if (!runsFrom(RUN)) return true
    return !runsFrom(RUN)
  }
  signal('TERM')
  if (await gone()) return
  signal('KILL')
  if (!(await gone())) throw new Error(`processes from ${RUN} survived SIGKILL; ${RUN} kept`)
}

function pathsOf(dir) {
  return [...new Set([dir, existsSync(dir) ? realpathSync(dir) : dir])]
}

// Whether a process of this user has dir in its command line.
function runsFrom(dir) {
  return pathsOf(dir).some(
    (path) => spawnSync('pgrep', ['-U', uid(), '-f', `${path}/`]).status === 0
  )
}

function uid() {
  return String(process.getuid())
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
  await stopRunProcesses()
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

// fuzz: a seeded random walk over the controls the ARIA snapshot shows, with five invariants
// checked after every step (F3 in #188). App-specific knowledge is FUZZ_SKIP, FUZZ_KEYS,
// FUZZ_CRASH, FUZZ_ROW, `atHome` and the settings file; the rest copies as is into another app's
// driver. Links are left out: in Talyx they open the system browser.
const FUZZ_ROLES = new Set([
  'button',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'tab',
  'checkbox',
  'switch',
  'radio',
  'option',
  'combobox',
  'textbox'
])
// Escape is listed three times so the walk often tests the Escape invariant.
const FUZZ_KEYS = [
  ...['Escape', 'Escape', 'Escape', 'Tab', 'Shift+Tab', 'Enter', 'Space', 'ArrowDown', 'ArrowUp'],
  ...['Alt+ArrowUp', 'Alt+ArrowDown', 'ControlOrMeta+Slash', 'ControlOrMeta+Comma'],
  ...['ControlOrMeta+f', 'ControlOrMeta+n', 'ControlOrMeta+l', 'ControlOrMeta+1'],
  // The row menus (pin, Move to, a folder's New folder, the bulk menu) open only on the last two
  // and on a right-click.
  ...['ControlOrMeta+2', 'Shift+F10', 'ContextMenu']
]
// How a click lands, by cumulative share: right-click opens the row menus, Shift picks a range of
// rows and ControlOrMeta toggles one, which is how the bulk menu is reached.
const FUZZ_CLICKS = [
  { share: 0.15, button: 'right', modifiers: [] },
  { share: 0.25, button: 'left', modifiers: ['Shift'] },
  { share: 0.35, button: 'left', modifiers: ['ControlOrMeta'] },
  { share: 1, button: 'left', modifiers: [] }
]
// Share of steps that drag a roster row onto another (folder into folder, pin order, a row into a
// folder: some only drag reaches), then of steps that act on a control; the rest press a key.
const FUZZ_DRAG_SHARE = 0.05
const FUZZ_CONTROL_SHARE = 0.75
// Draggable roster rows (bots, rooms, folders) and where on the target the drop lands, as a share
// of its height: the before, inside and after edges of a drop slot.
const FUZZ_ROW = '[data-roster-row]'
const FUZZ_DROPS = [
  { edge: 'top', share: 0.1 },
  { edge: 'middle', share: 0.5 },
  { edge: 'bottom', share: 0.9 }
]
// Radix sets `pointer-events: none` on body while a modal layer is open; with none open, the app
// ignores every click until reload. A closing layer clears it within its animation. A listbox
// counts too (a Select's list is modal), so the check also rests while chat search lists results.
const OPEN_LAYER = '[role=dialog], [role=alertdialog], [role=menu], [role=listbox]'
const LAYER_SETTLE_MS = 300
// Controls that leave the sandbox (native panels, the microphone, the browser, the clipboard,
// login items, installs, updates), enter the setup flow (no Escape exit by design), or approve a
// bot's tool call, which runs on the real machine even when the engine lives in the run's home.
const FUZZ_SKIP =
  /^(Choose file|Install|Install the engine|Get started|Run setup again|Open release page|Get the latest Talyx|Download|Restart to update|Launch at login|Add images or files|Dictate|Update the engine|Allow|Allow once|Allow in this chat|Always allow)$|^Copy|^Open (the|ChatGPT)|^Update to |Sign in/
const FUZZ_CRASH = /^(This part of )?Talyx stopped working\.$/
const FUZZ_TEXT = ['', 'a', 'Fuzz 😀 ünï', '<b>x</b>', 'x'.repeat(300)]
const FUZZ_STEPS = 200
// Set up in a --no-engine run, the engine and its gateway live in the run's home.
const SANDBOX_ENGINE = join(HOME, '.local/bin', ENGINE_COMMAND)

// The Agents page: the footer's Settings button shows (not Close Settings, not the setup flow),
// with no Back (Settings, Usage) and no dialog over it. Without an engine, the engine gate, which
// fills the window, is home.
async function atHome(page) {
  const button = (name) => page.getByRole('button', { name, exact: true })
  const gate = page.getByRole('heading', { name: 'Talyx needs its engine.', exact: true })
  const agents = (await button('Settings').count()) > 0 && !(await button('Back').count())
  return (agents || (await gate.count()) > 0) && !(await page.getByRole('dialog').count())
}

async function fuzz() {
  if (!existsSync(MODE_FILE) || readFileSync(MODE_FILE, 'utf8') !== 'no-engine')
    throw new Error('fuzz needs a run started with launch --no-engine; it would click real bots')
  const seed = integerFlag('seed', null)
  const steps = integerFlag('steps', FUZZ_STEPS)
  const random = mulberry32(seed)
  const engine = existsSync(SANDBOX_ENGINE)
  if (engine && gatewayGone()) throw new Error(`no gateway runs from ${HOME}`)
  const page = await mainPage()
  const errors = []
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))
  page.on('pageerror', (error) => errors.push(error.message))
  const log = []
  const fail = async (step, why) => {
    const dir = join(EVIDENCE, `fuzz-${seed}`)
    save(join(dir, 'steps.log'), log.join('\n'))
    save(join(dir, 'after.aria.txt'), await page.locator('body').ariaSnapshot())
    await page.screenshot({ path: join(dir, 'after.png') })
    throw new Error(`fuzz seed ${seed} failed at step ${step}: ${why}\n${log.join('\n')}`)
  }
  const check = async (step) => {
    const broken = (await brokenInvariant(page, errors)) ?? (engine && gatewayGone())
    if (broken) await fail(step, broken)
  }
  try {
    for (let step = 1; step <= steps; step++) {
      const controls = parseControls(await page.locator('body').ariaSnapshot())
      const action = chooseAction(random, controls, await rosterRows(page))
      log.push(`${step} ${await fuzzAct(page, action)}`)
      await sleep(150)
      await check(step)
      if (action.key === 'Escape' && !(await atHome(page))) {
        await page.keyboard.press('Escape')
        await sleep(150)
        log.push(`${step} press Escape (second)`)
        await check(step)
        if (!(await atHome(page))) await fail(step, 'two Escapes did not return to the Agents page')
      }
    }
    save(join(EVIDENCE, `fuzz-${seed}`, 'steps.log'), log.join('\n'))
    console.log(
      `fuzz seed ${seed}: ${steps} steps, invariants held${engine ? ', sandbox engine' : ''}`
    )
  } finally {
    await page.context().browser().close()
  }
}

// Nothing the fuzz may click stops the run's gateway. Its command starts with a program in the
// run's home; a shell or tail that only names the path does not count. Talyx restarts a gateway
// that dies, so this sees a stop only while it lasts.
function gatewayGone() {
  const running = pathsOf(HOME).some(
    (path) => spawnSync('pgrep', ['-U', uid(), '-f', `^${escapeRegExp(path)}/`]).status === 0
  )
  return running ? null : `the gateway in ${HOME} stopped`
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// A whole-number flag, so a typo cannot pass as a run (`--seed` alone parses as true).
function integerFlag(name, fallback) {
  const raw = flags[name] ?? fallback
  if (raw === null || !/^\d+$/.test(String(raw)))
    throw new Error(`fuzz needs --${name} <integer>, so a run replays`)
  return Number(raw)
}

// One step's action. Every step draws the same four numbers in the same order, used or not, so a
// seed replays the same walk whichever branch a step takes.
function chooseAction(random, controls, rows) {
  const [kind, target, mouse, extra] = [random(), random(), random(), random()]
  const from = (list, draw) => list[Math.floor(draw * list.length)]
  if (kind < FUZZ_DRAG_SHARE && rows.length > 1) {
    const source = from(rows, target)
    const others = rows.filter((row) => row !== source)
    return { drag: source, onto: from(others, extra), drop: from(FUZZ_DROPS, mouse) }
  }
  if (kind < FUZZ_CONTROL_SHARE && controls.length) {
    const click = FUZZ_CLICKS.find((item) => mouse < item.share)
    return { ...from(controls, target), click, text: from(FUZZ_TEXT, extra) }
  }
  return { key: from(FUZZ_KEYS, target) }
}

// The keys of the roster rows a drag can start from, in page order.
async function rosterRows(page) {
  return page
    .locator(FUZZ_ROW)
    .evaluateAll((rows) =>
      rows
        .filter((row) => row.getAttribute('draggable') === 'true' && row.offsetParent !== null)
        .map((row) => row.dataset.rosterRow)
    )
}

// The first broken invariant (crash notice, console error, settings.json, a page that ignores
// clicks), or null.
async function brokenInvariant(page, errors) {
  if (await page.getByText(FUZZ_CRASH).count()) return 'crash notice shown'
  if (errors.length) return `console.error: ${errors.join(' | ')}`
  if (await clicksBlocked(page)) return 'body ignores clicks with no open layer'
  try {
    JSON.parse(readFileSync(join(USER_DATA, 'settings.json'), 'utf8'))
    return null
  } catch (error) {
    return `settings.json does not parse: ${error.message}`
  }
}

async function clicksBlocked(page) {
  const blocked = () =>
    page.evaluate(
      (layer) =>
        getComputedStyle(document.body).pointerEvents === 'none' && !document.querySelector(layer),
      OPEN_LAYER
    )
  if (!(await blocked())) return false
  await sleep(LAYER_SETTLE_MS)
  return blocked()
}

// The interactive controls in an ARIA snapshot, as role and exact name, minus FUZZ_SKIP.
function parseControls(aria) {
  const controls = []
  for (const [, role, raw] of aria.matchAll(/^\s*- '?(\w+) "((?:[^"\\]|\\.)*)"/gm)) {
    const name = JSON.parse(`"${raw}"`)
    if (FUZZ_ROLES.has(role) && !FUZZ_SKIP.test(name)) controls.push({ role, name })
  }
  return controls
}

async function fuzzAct(page, action) {
  if (action.drag) return fuzzDrag(page, action)
  if (action.key) {
    // Enter and Space press the focused control, so they honour FUZZ_SKIP like clicks do, and
    // never follow a link (it opens the system browser).
    if (action.key === 'Enter' || action.key === 'Space') {
      const focused = await page.evaluate(() => {
        // The control that holds focus (or contains it); nothing when focus is on the page.
        const control = document.activeElement?.closest('button, a, input, select, [role]')
        if (!control) return { link: false, name: '' }
        return {
          link: control.closest('a[href]') !== null,
          name: (control.getAttribute('aria-label') ?? control.textContent ?? '')
            .trim()
            .slice(0, 80)
        }
      })
      if (focused.link || FUZZ_SKIP.test(focused.name))
        return `skip ${action.key} on "${focused.name}"`
    }
    await page.keyboard.press(action.key)
    return `press ${action.key}`
  }
  const target = page.getByRole(action.role, { name: action.name, exact: true }).first()
  const value = action.role === 'textbox' || action.role === 'combobox' ? action.text : null
  const { button, modifiers } = action.click
  const how = [...modifiers, button === 'right' ? 'right-click' : 'click'].join('+').toLowerCase()
  try {
    if (value !== null) await target.fill(value, { timeout: 2000 })
    else await target.click({ button, modifiers, timeout: 2000 })
    return `${value !== null ? 'fill' : how} ${action.role} "${action.name}"${value !== null ? ` with ${JSON.stringify(value.slice(0, 20))}` : ''}`
  } catch (error) {
    // A disabled, covered or vanished control is part of the walk, not a failure.
    return `skip ${action.role} "${action.name}": ${error.message.split('\n')[0]}`
  }
}

// Drags one roster row onto another, dropping at the target's top, middle or bottom.
async function fuzzDrag(page, { drag, onto, drop }) {
  const row = (key) => page.locator(`${FUZZ_ROW}[data-roster-row=${JSON.stringify(key)}]`).first()
  const what = `drag "${drag}" to "${onto}" at ${drop.edge}`
  try {
    const target = row(onto)
    const box = await target.boundingBox({ timeout: 2000 })
    if (!box) return `skip ${what}: target not shown`
    await row(drag).dragTo(target, {
      targetPosition: { x: box.width / 2, y: box.height * drop.share },
      timeout: 2000
    })
    return what
  } catch (error) {
    return `skip ${what}: ${error.message.split('\n')[0]}`
  }
}

// A small seeded generator, so a seed replays the same walk.
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
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
  // The scheme the window paints (the root's `dark` class), which neither the ARIA tree nor
  // settings.json shows.
  async theme(page) {
    const dark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
    console.log(dark ? 'dark' : 'light')
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
