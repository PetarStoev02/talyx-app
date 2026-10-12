import type { Effect } from '../instruction/model/Effect'

export type Approval = 'auto' | 'ask'

/** Reads never ask. Anything that creates or mutates shows the card. */
export function approvalFor(effect: Effect): Approval {
  return effect.world === 'reads' ? 'auto' : 'ask'
}

/**
 * "Approve the rest of this task" has a floor: shell commands of these shapes always
 * show the card. A denylist is a floor, not a security boundary — anything it misses
 * still runs after "rest". A command word may carry a path (`/bin/rm`), a backslash
 * (`\rm`) or quotes (`sh -c "rm x"`, `"rm" x`) to dodge aliases; all still match.
 */
const COMMAND_WORD = String.raw`(^|[\s;&|(\x60"'])(\S*/)?\\?`
/** A quoted command word may also close its quote, but only where a command starts. */
const QUOTED_COMMAND_START = String.raw`(^|[;&|(\x60])\s*["'](\S*/)?\\?`

function commandWord(words: string): string {
  return `${COMMAND_WORD}(${words})(\\s|$)|${QUOTED_COMMAND_START}(${words})["'](\\s|$)`
}

const DESTRUCTIVE_COMMAND = new RegExp(
  `${commandWord('rm|sudo|dd|mkfs(\\.\\w+)?|shred|srm')}|\\bgit\\s+push\\b.*\\s(--force|-f)\\b|\\s-delete\\b|>`
)
/** Anything that can carry data off the machine; a prompt-injected task would use these. */
const NETWORK_COMMAND = new RegExp(
  // A URL means the command talks to the network, whatever the program.
  `${commandWord('curl|wget|nc|ncat|scp|sftp|rsync|ssh|ftp')}|\\|\\s*(ba|z)?sh\\b|://`
)

/** Both shells the assistant can reach: Talyx's run_in_repo and Claude Code's Bash. */
const SHELL_TOOLS = new Set(['run_in_repo', 'Bash'])

/**
 * Nothing unsends a message, un-types into another app, or unsends a request, so these
 * cards are never skipped — not even after "approve the rest". Screen and web content
 * is untrusted, and the card is the one place the owner sees what is about to happen.
 */
const ALWAYS_CARDED = new Set([
  'send_message',
  'click',
  'type_text',
  'press_keys',
  'scroll',
  'open_url',
  'WebFetch',
  'WebSearch'
])

export function needsCardDespiteRest(tool: string, payload: unknown): boolean {
  if (ALWAYS_CARDED.has(tool)) return true
  if (!SHELL_TOOLS.has(tool)) return false
  const command = (payload as { command?: unknown }).command
  return (
    typeof command === 'string' &&
    (DESTRUCTIVE_COMMAND.test(command) || NETWORK_COMMAND.test(command))
  )
}
