import { basename } from 'path'
import type { ActivityStatus } from './Brain'

const TALYX_TOOL_PREFIX = 'mcp__talyx__'
const MAX_COMMAND_CHARS = 60

/**
 * What the model just reached for, as the orb label. Literal — a path, a
 * command, a query — never a paraphrase; the user is watching, not reading.
 */
export function describeToolUse(name: string, input: unknown): ActivityStatus {
  const tool = name.startsWith(TALYX_TOOL_PREFIX) ? name.slice(TALYX_TOOL_PREFIX.length) : name
  const field = fieldReader(input)
  switch (tool) {
    case 'Read':
      return searching(withSubject('Reading', file(field('file_path'))))
    case 'Glob':
    case 'Grep':
      return searching(withSubject('Searching', quoted(field('pattern'))))
    case 'WebFetch':
      return searching(withSubject('Fetching', host(field('url'))))
    case 'WebSearch':
      return searching(withSubject('Searching the web for', quoted(field('query'))))
    case 'Bash':
      return working(withSubject('Running', command(field('command'))))
    case 'Edit':
    case 'MultiEdit':
      return working(withSubject('Editing', file(field('file_path'))))
    case 'Write':
      return working(withSubject('Writing', file(field('file_path'))))
    case 'NotebookEdit':
      return working(withSubject('Editing', file(field('notebook_path'))))
    case 'list_repos':
      return searching('Listing repos')
    case 'run_in_repo':
      return working(withSubject('Running', inRepo(command(field('command')), field('repo'))))
    case 'find_file':
      return searching(withSubject('Looking for', quoted(field('query'))))
    case 'search_files':
      return searching(withSubject('Searching files for', quoted(field('query'))))
    case 'recall':
      return searching(withSubject('Recalling', quoted(field('query'))))
    case 'triage':
      return searching('Checking what needs you')
    case 'brief_me':
      return searching('Preparing your briefing')
    case 'disk_space':
      return searching('Checking disk space')
    case 'find_duplicates':
      return searching(withSubject('Finding duplicates in', field('folder')))
    case 'sort_folder':
      return working(withSubject('Sorting', field('folder')))
    case 'open_app':
      return working(withSubject('Opening', field('name')))
    case 'open_url':
      return working(withSubject('Opening', host(field('url'))))
    case 'undo_last':
      return working('Undoing the last change')
    case 'today':
      return searching('Checking your calendar')
    case 'remind_me':
      return working('Adding a reminder')
    case 'take_note':
      return working('Writing a note')
    case 'read_document':
      return searching(withSubject('Reading', file(field('path'))))
    case 'whats_cluttering':
      return searching(withSubject('Looking at', field('folder')))
    case 'system_toggle':
      return working('Changing a setting')
    case 'set_volume':
      return working('Setting the volume')
    case 'open_recent':
      return searching('Finding recent files')
    case 'music_control':
      return working('Controlling the music')
    case 'convert_file':
      return working(withSubject('Converting', file(field('path'))))
    case 'unread_mail':
      return searching('Checking your inbox')
    case 'focus':
      return working('Setting up focus')
    case 'look_at_screen':
      return searching('Looking at the screen')
    case 'click':
      return working(withSubject('Clicking', field('target')))
    case 'type_text':
      return working('Typing')
    case 'press_keys':
      return working(withSubject('Pressing', field('keys')))
    case 'scroll':
      return working(withSubject('Scrolling', field('target')))
    default:
      return working(`Using ${tool}`)
  }
}

function searching(label: string): ActivityStatus {
  return { state: 'searching', label }
}

function working(label: string): ActivityStatus {
  return { state: 'working', label }
}

/** Reads string fields off model-supplied input; anything else is ''. */
function fieldReader(input: unknown): (key: string) => string {
  const record =
    typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {}
  return (key) => (typeof record[key] === 'string' ? (record[key] as string) : '')
}

function withSubject(verb: string, subject: string): string {
  return subject.length > 0 ? `${verb} ${subject}` : verb
}

function file(path: string): string {
  return path.length > 0 ? basename(path) : ''
}

function quoted(text: string): string {
  return text.length > 0 ? `"${text}"` : ''
}

function host(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

function command(text: string): string {
  return text.length > MAX_COMMAND_CHARS ? `${text.slice(0, MAX_COMMAND_CHARS)}…` : text
}

function inRepo(text: string, repo: string): string {
  return repo.length > 0 && text.length > 0 ? `${text} in ${repo}` : text
}
