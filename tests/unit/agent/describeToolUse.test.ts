import { describe, it, expect } from 'vitest'
import { describeToolUse } from '../../../src/main/domain/agent/describeToolUse'

describe('describeToolUse', () => {
  it.each([
    ['Read', { file_path: '/Users/p/Code/talyx/README.md' }, 'searching', 'Reading README.md'],
    ['focus', {}, 'working', 'Setting up focus'],
    ['look_at_screen', {}, 'searching', 'Looking at the screen'],
    ['click', { x: 1, y: 2, target: 'the Send button' }, 'working', 'Clicking the Send button'],
    ['type_text', { text: 'secret' }, 'working', 'Typing'],
    ['press_keys', { keys: 'cmd+s' }, 'working', 'Pressing cmd+s'],
    ['scroll', { target: 'the list', direction: 'down' }, 'working', 'Scrolling the list'],
    ['Glob', { pattern: '**/*.ts' }, 'searching', 'Searching "**/*.ts"'],
    ['Grep', { pattern: 'TODO' }, 'searching', 'Searching "TODO"'],
    ['WebFetch', { url: 'https://docs.example.com/a/b' }, 'searching', 'Fetching docs.example.com'],
    ['WebSearch', { query: 'zod v4 pipe' }, 'searching', 'Searching the web for "zod v4 pipe"'],
    ['Bash', { command: 'npm test' }, 'working', 'Running npm test'],
    ['Edit', { file_path: '/r/src/x.ts' }, 'working', 'Editing x.ts'],
    ['MultiEdit', { file_path: '/r/src/x.ts' }, 'working', 'Editing x.ts'],
    ['Write', { file_path: '/r/new.txt' }, 'working', 'Writing new.txt'],
    ['NotebookEdit', { notebook_path: '/r/n.ipynb' }, 'working', 'Editing n.ipynb'],
    ['list_repos', {}, 'searching', 'Listing repos'],
    ['mcp__talyx__list_repos', {}, 'searching', 'Listing repos'],
    ['run_in_repo', { repo: 'talyx', command: 'npm test' }, 'working', 'Running npm test in talyx'],
    ['find_file', { query: 'invoice' }, 'searching', 'Looking for "invoice"'],
    ['search_files', { query: 'tax 2025' }, 'searching', 'Searching files for "tax 2025"'],
    ['disk_space', {}, 'searching', 'Checking disk space'],
    ['find_duplicates', { folder: 'downloads' }, 'searching', 'Finding duplicates in downloads'],
    ['sort_folder', { folder: 'downloads' }, 'working', 'Sorting downloads'],
    ['open_app', { name: 'Safari' }, 'working', 'Opening Safari'],
    ['open_url', { url: 'https://github.com/x/y' }, 'working', 'Opening github.com'],
    ['undo_last', {}, 'working', 'Undoing the last change'],
    ['today', { day: 'tomorrow' }, 'searching', 'Checking your calendar'],
    ['remind_me', { title: 'Call mom' }, 'working', 'Adding a reminder'],
    ['take_note', { title: 'Coffee' }, 'working', 'Writing a note'],
    ['read_document', { path: '/a/budget.pdf' }, 'searching', 'Reading budget.pdf'],
    ['whats_cluttering', { folder: 'downloads' }, 'searching', 'Looking at downloads'],
    ['system_toggle', { setting: 'dark_mode', on: true }, 'working', 'Changing a setting'],
    ['set_volume', { percent: 30 }, 'working', 'Setting the volume'],
    ['open_recent', { hours: 24 }, 'searching', 'Finding recent files'],
    ['music_control', { action: 'play', query: 'daft punk' }, 'working', 'Controlling the music'],
    ['convert_file', { path: '/p/IMG_1.HEIC', to: 'jpg' }, 'working', 'Converting IMG_1.HEIC'],
    ['unread_mail', { limit: 20 }, 'searching', 'Checking your inbox'],
    ['Mystery', { a: 1 }, 'working', 'Using Mystery']
  ] as const)('should describe %s', (name, input, state, label) => {
    expect(describeToolUse(name, input)).toEqual({ state, label })
  })

  it('should truncate a long command', () => {
    const command = 'x'.repeat(80)
    const { label } = describeToolUse('Bash', { command })
    expect(label).toBe(`Running ${'x'.repeat(60)}…`)
  })

  it('should survive input that is not an object', () => {
    expect(describeToolUse('Read', null)).toEqual({ state: 'searching', label: 'Reading' })
    expect(describeToolUse('Bash', 'npm test')).toEqual({ state: 'working', label: 'Running' })
  })
})
