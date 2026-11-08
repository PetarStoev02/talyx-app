// The text "Copy diagnostics" puts on the clipboard for a bug report. The user pastes it into
// public places, so every secret pattern below is hidden before it leaves the app.

const REDACTED = '[redacted]'

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  // A password in a URL: scheme://user:password@host
  [/(\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+):[^\s@/]+@/gi, `$1:${REDACTED}@`],
  // An Authorization or Cookie header or field (proxy_authorization, session_cookie...): the
  // whole rest of the line, whatever the scheme
  [/\b(\w*(?:authorization|cookie))(["']?[ \t]*[:=][ \t]*).*/gi, `$1$2${REDACTED}`],
  // A bearer token without its header name ("basic" alone is too common a word to match)
  [/\b(bearer)\s+[A-Za-z0-9._~+/=-]+/gi, `$1 ${REDACTED}`],
  // A named field: api_key=..., "token": "...", OPENROUTER_API_KEY=..., password: '...'. A quoted
  // value is hidden up to its closing quote, spaces and escapes included.
  [
    /\b(\w*(?:api[_-]?key|apikey|token|secret|password|passwd|credential|ticket)\w*)(["']?[ \t]*[:=][ \t]*)(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^\s"'&,;}]+)/gi,
    `$1$2${REDACTED}`
  ],
  // Well-known key shapes, wherever they appear
  [/\bsk-[A-Za-z0-9_-]{8,}/g, REDACTED],
  [/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_\w{20,})/g, REDACTED],
  [/\bAIza[0-9A-Za-z_-]{20,}/g, REDACTED],
  [/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, REDACTED],
  [/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, REDACTED],
  // Any other long opaque run with a digit in it (tickets, hashes, unknown key formats)
  [/(?=[A-Za-z0-9_+=-]*\d)[A-Za-z0-9_+=-]{32,}/g, REDACTED]
]

/** Hides keys, tokens and passwords in `text`; ordinary log lines pass through unchanged. */
export function redactSecrets(text: string): string {
  return SECRET_PATTERNS.reduce(
    (out, [pattern, replacement]) => out.replace(pattern, replacement),
    text
  )
}

/** The last `count` lines of a log file's text. */
export function logTail(log: string, count: number): string {
  const lines = log.split('\n')
  if (lines.at(-1) === '') lines.pop()
  return lines.slice(-count).join('\n')
}

export interface Diagnostics {
  talyx: string
  /** The engine as the page shows it: its version, or its state when it is not attached. */
  engine: string
  os: string
  log: string
  /** The user's home folder, shown as ~ so the user name stays out of the report. */
  home: string
}

export function diagnosticsReport({ talyx, engine, os, log, home }: Diagnostics): string {
  const text = [
    `Talyx ${talyx}`,
    `Engine ${engine}`,
    `OS ${os}`,
    '',
    'Last log lines:',
    log || '(no log lines)'
  ].join('\n')
  return redactSecrets(home ? text.replace(homePattern(home), '~') : text)
}

// The home folder only as a whole path segment: /home/al must not turn /home/alice into ~ice.
function homePattern(home: string): RegExp {
  return new RegExp(`${home.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w.-])`, 'g')
}
