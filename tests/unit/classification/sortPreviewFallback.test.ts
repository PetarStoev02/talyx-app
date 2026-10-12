import { describe, it, expect, vi } from 'vitest'
import type { ClassifiedFile } from '../../../src/main/domain/sorting/services/SortExecutor'
import type { Sorter } from '../../../src/main/domain/classification/services/Sorter'

const handlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => Promise<unknown>>())

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
      handlers.set(channel, handler)
    }
  },
  shell: { trashItem: vi.fn() }
}))

const throwingSorter: Sorter = {
  id: 'claude',
  engineVersion: 'claude:test',
  async classify() {
    throw new Error('claude code not signed in')
  }
}

vi.mock('../../../src/main/infrastructure/ipc/resolveSorter', () => ({
  resolveSorter: () => throwingSorter,
  findOwnersClaude: () => null
}))

const { registerSortIpc } = await import('../../../src/main/infrastructure/ipc/sort.ipc')

/** The preview stage that always runs: extension + metadata, never a model. */
const smartLocal = {
  classify: async () => ({
    category: 'Documents',
    subcategory: null,
    confidence: 0.5,
    metadata: {},
    semanticPath: ['Documents'],
    suggestedName: null,
    entities: { dates: [], names: [], amounts: [], organizations: [], locations: [] }
  })
}

const readableText = {
  extract: async () => ({
    text: 'Invoice 44616, total 1200.00 EUR',
    metadata: {},
    truncated: false,
    readContent: true
  })
}

registerSortIpc({
  pipeline: smartLocal as never,
  executor: {} as never,
  undoService: {} as never,
  historyRepo: {} as never,
  textExtractor: readableText as never,
  settingsStore: { store: { appLanguage: 'en', sorterSource: 'claude' } } as never
})

function preview(files: unknown[]): {
  result: Promise<ClassifiedFile[]>
  progress: Array<Record<string, unknown>>
} {
  const progress: Array<Record<string, unknown>> = []
  const event = { sender: { send: (_c: string, p: Record<string, unknown>) => progress.push(p) } }
  return {
    result: handlers.get('sort:preview')!(event, files) as Promise<ClassifiedFile[]>,
    progress
  }
}

describe('sort:preview when the chosen sorter blows up', () => {
  it('should still return the Smart Local plan for every file', async () => {
    const files = [
      { name: 'invoice.pdf', path: '/tmp/invoice.pdf', extension: '.pdf', size: 100 },
      { name: 'notes.txt', path: '/tmp/notes.txt', extension: '.txt', size: 200 }
    ]

    const plan = await preview(files).result

    expect(plan.map((f) => f.name)).toEqual(['invoice.pdf', 'notes.txt'])
    expect(plan.every((f) => f.classification.category === 'Documents')).toBe(true)
  })

  it('should name the sorter that actually ran so the page can say so', async () => {
    const run = preview([
      { name: 'invoice.pdf', path: '/tmp/invoice.pdf', extension: '.pdf', size: 100 }
    ])
    await run.result

    expect(run.progress.find((p) => p.phase === 'done')?.sorter).toBe('smart-local')
  })
})
