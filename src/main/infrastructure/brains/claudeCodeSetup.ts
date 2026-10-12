import { execFile, spawn } from 'child_process'

/**
 * Getting Claude Code onto the Mac and signed in, for owners who have never
 * opened a terminal. Everything here drives Anthropic's own installer and the
 * CLI's own auth commands; Talyx never handles the credentials.
 */

/** Anthropic's documented installer. Constant on purpose: never built from input. */
const INSTALLER_URL = 'https://claude.ai/install.sh'
export const INSTALL_COMMAND = `curl -fsSL ${INSTALLER_URL} | bash`

const STATUS_TIMEOUT_MS = 10_000
const INSTALL_TIMEOUT_MS = 10 * 60_000
/** The login page has to be opened, read and filled in by a person. */
const LOGIN_TIMEOUT_MS = 5 * 60_000
const POLL_INTERVAL_MS = 2000

export interface ClaudeCodeAuth {
  loggedIn: boolean
  /** Shown so the owner can tell which account Talyx will spend. */
  email: string | null
  /** "max", "team", "pro"… straight from the CLI; null when it does not say. */
  plan: string | null
}

const SIGNED_OUT: ClaudeCodeAuth = { loggedIn: false, email: null, plan: null }

/** Exported for the test: the shape comes from another program. */
export function parseAuthStatus(stdout: string): ClaudeCodeAuth {
  try {
    const raw: unknown = JSON.parse(stdout)
    if (typeof raw !== 'object' || raw === null) return SIGNED_OUT
    const record = raw as Record<string, unknown>
    return {
      loggedIn: record.loggedIn === true,
      email: typeof record.email === 'string' ? record.email : null,
      plan: typeof record.subscriptionType === 'string' ? record.subscriptionType : null
    }
  } catch {
    return SIGNED_OUT
  }
}

/**
 * Whether this Claude Code is signed in, asked of the CLI itself. Costs no
 * tokens and no model turn, unlike driving a whole conversation to find out.
 */
export function readAuthStatus(claudeCodePath: string): Promise<ClaudeCodeAuth> {
  return new Promise((resolve) => {
    execFile(
      claudeCodePath,
      ['auth', 'status', '--json'],
      { timeout: STATUS_TIMEOUT_MS },
      (_err, stdout) => {
        // A signed-out CLI can exit non-zero and still print the status JSON.
        resolve(parseAuthStatus(stdout ?? ''))
      }
    )
  })
}

/**
 * Runs Anthropic's installer. The command is shown in the UI before this runs,
 * so nothing is piped to a shell behind the owner's back.
 */
export function installClaudeCode(onOutput: (line: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('/bin/bash', ['-lc', INSTALL_COMMAND], {
      stdio: ['ignore', 'pipe', 'pipe']
    })
    const timer = setTimeout(() => child.kill('SIGKILL'), INSTALL_TIMEOUT_MS)
    let tail = ''

    const read = (chunk: Buffer): void => {
      const text = chunk.toString()
      tail = (tail + text).slice(-2000)
      for (const line of text.split('\n')) {
        const trimmed = line.trim()
        if (trimmed.length > 0) onOutput(trimmed)
      }
    }
    child.stdout.on('data', read)
    child.stderr.on('data', read)

    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) return resolve()
      reject(new Error(`The installer stopped with code ${code}. ${tail.slice(-400)}`.trim()))
    })
  })
}

const URL_PATTERN = /https?:\/\/[^\s'"]+/

export interface LoginHandle {
  /** Resolves once the CLI reports a signed-in account, rejects on timeout. */
  done: Promise<ClaudeCodeAuth>
  cancel: () => void
}

/**
 * Starts the CLI's own sign-in and reports the URL it wants opened, so the
 * owner lands in their browser instead of a terminal. Resolves by polling the
 * CLI, not by reading its output, because the flow finishes in the browser.
 */
export function startLogin(input: {
  claudeCodePath: string
  cwd: string
  onUrl: (url: string) => void
  now?: () => number
}): LoginHandle {
  const now = input.now ?? (() => Date.now())
  const startedAt = now()
  const child = spawn(input.claudeCodePath, ['auth', 'login', '--claudeai'], {
    cwd: input.cwd,
    stdio: ['ignore', 'pipe', 'pipe']
  })

  let sentUrl = false
  const watch = (chunk: Buffer): void => {
    if (sentUrl) return
    const match = URL_PATTERN.exec(chunk.toString())
    if (match) {
      sentUrl = true
      input.onUrl(match[0])
    }
  }
  child.stdout.on('data', watch)
  child.stderr.on('data', watch)
  child.on('error', () => {})

  let stopped = false
  const cancel = (): void => {
    stopped = true
    child.kill('SIGTERM')
  }

  const done = (async (): Promise<ClaudeCodeAuth> => {
    try {
      while (!stopped && now() - startedAt < LOGIN_TIMEOUT_MS) {
        const status = await readAuthStatus(input.claudeCodePath)
        if (status.loggedIn) return status
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
      }
      throw new Error('Sign-in did not finish.')
    } finally {
      child.kill('SIGTERM')
    }
  })()

  return { done, cancel }
}
