import { describe, it, expect, vi } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { CapabilityRegistry } from '../../../src/main/domain/instruction/model/CapabilityRegistry'
import {
  everydayCapabilities,
  type EverydayCapabilityDeps
} from '../../../src/main/domain/instruction/capabilities/everyday'
import {
  captureInboxPath,
  safeCaptureStem,
  writeCaptureInboxFile
} from '../../../src/main/domain/capture/captureInbox'
import type { CapabilityContext } from '../../../src/main/domain/instruction/model/Capability'

const ctx: CapabilityContext = {
  home: '/Users/test',
  projectsRoot: '/Users/test/Code',
  signal: new AbortController().signal,
  logger: { info: () => {}, warn: () => {} }
}

const NOW = new Date('2026-09-15T10:00:00.000+03:00')

function deps(overrides: Partial<EverydayCapabilityDeps> = {}): EverydayCapabilityDeps {
  return {
    now: () => NOW,
    calendarEvents: vi.fn(async () => []),
    createReminder: vi.fn(async () => ({ id: 'rem-1' })),
    createNote: vi.fn(async () => ({ id: 'note-1' })),
    createEvent: vi.fn(async () => ({ id: 'ev-1' })),
    deleteEvent: vi.fn(async () => {}),
    saveCaptureFile: vi.fn(async () => ({
      path: '/Users/test/Documents/Talyx Capture/meeting-notes-2026-09-15.md'
    })),
    recentFiles: vi.fn(async () => []),
    extractText: vi.fn(async () => ({ text: '', truncated: false })),
    scanFiles: vi.fn(async () => []),
    ...overrides
  }
}

describe('save_to_inbox', () => {
  it('should propose a capture file and write it on execute', async () => {
    const d = deps()
    const cap = new CapabilityRegistry(everydayCapabilities(d)).get('save_to_inbox')!
    const parsed = cap.params.parse({ title: 'meeting notes', body: 'ship by Friday' })
    const proposal = await cap.plan(parsed, ctx)
    if (proposal.kind !== 'plan') throw new Error('expected plan')
    expect(proposal.summary).toBe('Save to Capture inbox: meeting notes')
    const out = await cap.execute!(proposal.operations[0], ctx)
    expect(d.saveCaptureFile).toHaveBeenCalledWith({
      title: 'meeting notes',
      body: 'ship by Friday'
    })
    expect(out).toBe('Saved to /Users/test/Documents/Talyx Capture/meeting-notes-2026-09-15.md')
  })

  it('should register as an irreversible create', () => {
    const cap = new CapabilityRegistry(everydayCapabilities(deps())).get('save_to_inbox')!
    expect(cap.effect).toEqual({ world: 'creates', reversible: false, discloses: 'nothing' })
  })
})

describe('captureInbox', () => {
  it('should sanitize titles into file stems', () => {
    expect(safeCaptureStem('Meet/ing: notes?')).toBe('Meet-ing-notes')
  })

  it('should bump collision suffixes', () => {
    const exists = (path: string): boolean => path.endsWith('notes-2026-09-15.md')
    const path = captureInboxPath('notes', NOW, '/Users/test', exists)
    expect(path).toBe('/Users/test/Documents/Talyx Capture/notes-2026-09-15-2.md')
  })

  it('should write markdown under the inbox', () => {
    const home = mkdtempSync(join(tmpdir(), 'talyx-capture-'))
    try {
      const { path } = writeCaptureInboxFile({
        title: 'Idea',
        body: 'ship it',
        now: NOW,
        home
      })
      expect(readFileSync(path, 'utf8')).toBe('# Idea\n\nship it\n')
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })
})
