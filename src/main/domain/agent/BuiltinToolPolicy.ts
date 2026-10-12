import type { PendingProposal } from './Brain'

export type BuiltinToolClass = 'auto' | 'ask' | 'deny'

/** Talyx's own abilities arrive through the SDK MCP server under this prefix;
 *  their handlers show their own card, so the policy lets them through. */
const TALYX_TOOL_PREFIX = 'mcp__talyx__'
/** canUseTool only fires for calls Claude Code would prompt for; this table decides those.
 *  The hard block is DENIED_BUILTINS passed as disallowedTools — the model never sees them. */
const AUTO_BUILTINS = new Set(['Read', 'Glob', 'Grep', 'LS', 'TodoWrite'])
/** Also passed to the SDK as `disallowedTools`, so the model never sees them. */
export const DENIED_BUILTINS: readonly string[] = ['Task', 'KillShell']

const MAX_DIFF_LINES = 3
const MAX_UNKNOWN_INPUT_CHARS = 200

export function builtinToolClass(name: string): BuiltinToolClass {
  if (name.startsWith(TALYX_TOOL_PREFIX) || AUTO_BUILTINS.has(name)) return 'auto'
  if (DENIED_BUILTINS.includes(name)) return 'deny'
  return 'ask'
}

/** The card for a Claude Code built-in. Literal: it shows what the tool was given, never a paraphrase. */
export function describeBuiltinCall(call: {
  id: string
  name: string
  input: Record<string, unknown>
}): PendingProposal {
  const { summary, labels } = describe(call.name, call.input)
  return {
    id: call.id,
    tool: call.name,
    summary,
    reversible: false,
    operations: labels.map((label) => ({ label, reason: '' }))
  }
}

function describe(
  name: string,
  input: Record<string, unknown>
): { summary: string; labels: string[] } {
  switch (name) {
    case 'Bash': {
      const labels = [`$ ${str(input.command)}`]
      if (typeof input.cwd === 'string') labels.push(`in ${input.cwd}`)
      return { summary: 'Run a command', labels }
    }
    case 'Edit':
      return {
        summary: 'Edit file',
        labels: [str(input.file_path), ...diffLines(str(input.old_string), str(input.new_string))]
      }
    case 'MultiEdit': {
      const first = (Array.isArray(input.edits) ? input.edits[0] : null) as {
        old_string?: unknown
        new_string?: unknown
      } | null
      return {
        summary: 'Edit file',
        labels: [
          str(input.file_path),
          ...(first ? diffLines(str(first.old_string), str(first.new_string)) : [])
        ]
      }
    }
    case 'Write':
      return {
        summary: 'Write file',
        labels: [
          str(input.file_path),
          `${new TextEncoder().encode(str(input.content)).length} bytes`
        ]
      }
    case 'NotebookEdit':
      return {
        summary: 'Edit notebook',
        labels: [
          str(input.notebook_path),
          `cell ${typeof input.cell_id === 'string' ? input.cell_id : 'new'}`
        ]
      }
    default: {
      const json = JSON.stringify(input)
      const label =
        json.length > MAX_UNKNOWN_INPUT_CHARS ? `${json.slice(0, MAX_UNKNOWN_INPUT_CHARS)}…` : json
      return { summary: `Claude Code: ${name}`, labels: [label] }
    }
  }
}

function diffLines(oldText: string, newText: string): string[] {
  return [
    ...oldText
      .split('\n')
      .slice(0, MAX_DIFF_LINES)
      .map((l) => `- ${l}`),
    ...newText
      .split('\n')
      .slice(0, MAX_DIFF_LINES)
      .map((l) => `+ ${l}`)
  ]
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
