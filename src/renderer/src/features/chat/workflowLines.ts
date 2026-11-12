// What the Workflows module writes into chats, read back so the chat can show it compactly: the
// brief it sends Talyx, and the status lines the bots post for a task. The grammar lives here only.
//
// A brief opens with the marker line, then names the task and its workflow:
//   [Workflows brief]
//   Start a Workflows task for acme/api#7: Fix the login
//   Workflow: Ship a feature. …
//   Steps, in order:
//   1. [build] Build it (T3 Code thread, bot: t3-tots)
// A status line is one line of fields after the task's ref:
//   [run acme/api#7@mhq2x1c0] step=build round=2 pr=66
//   [run task#mwat3hrn@mwat3hrn] step=done result="Provider B, for its price."

export const BRIEF_MARK = '[Workflows brief]'

const TASK_LINE = /^Start a Workflows task for (\S+): (.*)$/
const WORKFLOW_LINE = /^Workflow: (.+?)\.(?: |$)/
const STEP_LINE = /^\d+\. \[([^\]\s]+)\] (.+?) \(/
// The line is a status line only when nothing but fields follows the ref (quoted values may hold
// spaces); a code span around the whole line, as some bots write it, is allowed.
const STATUS_LINE = /^`?\[run ([^\]\s]+)\] ((?:\s*\w+=(?:"[^"]*"|[^\s"`]+))+)\s*`?$/
const FIELD = /(\w+)=(?:"([^"]*)"|([^\s"`]+))/g
const FENCE = /^\s*(```|~~~)/
// The brief's own template, quoted back by a bot, is not a report.
const TEMPLATE = 'step=<step>'

export interface WorkflowBrief {
  /** The task's ref without its run tag, as status lines start with it: `acme/api#7`. */
  ref: string
  title: string
  workflow: string | null
  /** Step titles by step id, to name the step a status line reports. */
  steps: Record<string, string>
}

export interface WorkflowStatus {
  /** The ref with its run tag, as written: `acme/api#7@mhq2x1c0`. */
  run: string
  /** The ref without the tag, as the brief names the task. */
  ref: string
  fields: Record<string, string>
  /** The line as the bot wrote it, to show and copy as it is. */
  line: string
}

export type ReplyPart = { kind: 'text'; text: string } | { kind: 'status'; status: WorkflowStatus }

/** The brief a message is, or null when it does not open with the marker and the task line. */
export function parseBrief(text: string): WorkflowBrief | null {
  const lines = text.split('\n').map((line) => line.trim())
  if (lines[0] !== BRIEF_MARK) return null
  const task = TASK_LINE.exec(lines[1] ?? '')
  if (!task) return null
  const workflow = lines.map((line) => WORKFLOW_LINE.exec(line)).find(Boolean)
  const steps: Record<string, string> = {}
  for (const line of lines) {
    const step = STEP_LINE.exec(line)
    if (step) steps[step[1]] = step[2]
  }
  return { ref: task[1], title: briefTitle(task[2]), workflow: workflow?.[1] ?? null, steps }
}

/**
 * The title as written: Workflows sends an issue's title JSON-quoted, since other people wrote
 * it, and a typed task's as it is.
 */
function briefTitle(written: string): string {
  if (!written.startsWith('"')) return written
  try {
    const title: unknown = JSON.parse(written)
    return typeof title === 'string' ? title : written
  } catch {
    // Not JSON after all: a typed task that starts with a quote.
    return written
  }
}

/** One status line's fields, or null when the line is not one (or is the brief's template). */
export function parseStatusLine(line: string): WorkflowStatus | null {
  const match = STATUS_LINE.exec(line.trim())
  if (!match || match[2].trim().startsWith(TEMPLATE)) return null
  const fields: Record<string, string> = {}
  for (const [, key, quoted, plain] of match[2].matchAll(FIELD)) fields[key] = quoted ?? plain
  if (!fields.step) return null
  return { run: match[1], ref: match[1].split('@')[0], fields, line: line.trim() }
}

/**
 * A reply cut into its status lines and the text around them, in order; text without any status
 * line comes back as one text part, unchanged.
 */
export function splitReply(text: string): ReplyPart[] {
  const parts: ReplyPart[] = []
  let pending: string[] = []
  const flush = (): void => {
    const joined = pending.join('\n')
    if (joined.trim()) parts.push({ kind: 'text', text: joined })
    pending = []
  }
  // A line in a fenced code block stays code: cutting there would break the block.
  let fenced = false
  for (const line of text.split('\n')) {
    if (FENCE.test(line)) fenced = !fenced
    const status = fenced ? null : parseStatusLine(line)
    if (!status) {
      pending.push(line)
      continue
    }
    flush()
    parts.push({ kind: 'status', status })
  }
  flush()
  return parts.length > 0 ? parts : [{ kind: 'text', text }]
}

/**
 * Whether a reply only reports a Workflows task moving along (a step of its workflow): the
 * Workflows page shows that, so the chat leaves it out. A reply that ends a task or waits on you
 * (ready, needs-you, merged, done, stopped) still shows, as does any reply without a status line.
 */
export function isProgressReport(text: string): boolean {
  const statuses = splitReply(text).flatMap((part) => (part.kind === 'status' ? [part.status] : []))
  return (
    statuses.length > 0 &&
    statuses.every((status) => !FIXED_STEPS.some((step) => step === status.fields.step))
  )
}

/** Every brief in a chat by its task's ref, so a status line can name its task and step. */
export function briefsByRef(texts: string[]): Record<string, WorkflowBrief> {
  const briefs: Record<string, WorkflowBrief> = {}
  for (const text of texts) {
    const brief = parseBrief(text)
    if (brief) briefs[brief.ref] = brief
  }
  return briefs
}

// The steps every task has besides its workflow's own: Talyx names these itself.
export const FIXED_STEPS = ['ready', 'needs-you', 'merged', 'done', 'stopped'] as const
export type FixedStep = (typeof FIXED_STEPS)[number]

export interface StatusSummary {
  /** The task's title from its brief in this chat, else its ref. */
  task: string
  /** A step of the workflow by its title (or id, without a brief), or one of the fixed steps. */
  step: { fixed: FixedStep } | { name: string }
  round: number | null
  /** What a done task came to, or why it needs you. */
  detail: string | null
}

/** What a status line says, in the words the chat shows, with the brief of its task if known. */
export function summarizeStatus(
  status: WorkflowStatus,
  brief: WorkflowBrief | undefined
): StatusSummary {
  const { step, round, result, reason } = status.fields
  const fixed = FIXED_STEPS.find((name) => name === step)
  return {
    task: brief?.title || status.ref,
    step: fixed ? { fixed } : { name: brief?.steps[step] ?? step },
    round: round && Number(round) > 1 ? Number(round) : null,
    detail: result ?? reason ?? null
  }
}
