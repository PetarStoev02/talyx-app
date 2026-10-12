import { describe, it, expect, vi } from 'vitest'
import { CapabilityRegistry } from '../../../../src/main/domain/instruction/model/CapabilityRegistry'
import {
  fileCapabilities,
  type FileCapabilityDeps
} from '../../../../src/main/domain/instruction/capabilities/files'
import type {
  CapabilityContext,
  Proposal
} from '../../../../src/main/domain/instruction/model/Capability'

const ctx: CapabilityContext = {
  home: '/Users/test',
  projectsRoot: '/Users/test/Code',
  signal: new AbortController().signal,
  logger: { info: () => {}, warn: () => {} }
}

function file(name: string): { name: string; path: string; size: number } {
  return { name, path: `/downloads/${name}`, size: 100 }
}

function deps(overrides: Partial<FileCapabilityDeps> = {}): FileCapabilityDeps {
  return {
    scanFolder: async () => [file('invoice.pdf'), file('holiday.jpg')],
    classify: async (files) =>
      files.map((f) => ({
        ...f,
        category: f.name.endsWith('.jpg') ? 'Images' : 'Documents',
        subcategory: f.name.endsWith('.jpg') ? 'Photos' : 'Invoices'
      })),
    findDuplicateGroups: async () => [['/downloads/a.pdf', '/downloads/a-copy.pdf']],
    searchFiles: async () => [
      { path: '/downloads/invoice.pdf', name: 'invoice.pdf', snippet: 'Amount due 1200' }
    ],
    apply: vi.fn(async () => {}),
    recordSortOperation: vi.fn(),
    convertImage: vi.fn(async () => {}),
    ...overrides
  }
}

function registry(overrides: Partial<FileCapabilityDeps> = {}): CapabilityRegistry {
  return new CapabilityRegistry(fileCapabilities(deps(overrides)))
}

async function propose(
  name: string,
  params: unknown,
  overrides: Partial<FileCapabilityDeps> = {}
): Promise<Proposal> {
  const capability = registry(overrides).get(name)!
  return capability.plan(capability.params.parse(params), ctx)
}

describe('sort_folder', () => {
  it('should propose one move per loose file, into its classified subfolder', async () => {
    const proposal = await propose('sort_folder', { folder: '/downloads', mode: 'move' })

    if (proposal.kind !== 'plan') throw new Error('expected a plan')
    expect(proposal.operations).toHaveLength(2)
    expect(proposal.operations[0].payload).toEqual(
      expect.objectContaining({
        kind: 'move',
        sourcePath: '/downloads/invoice.pdf',
        targetPath: '/downloads/Documents/Invoices/invoice.pdf',
        category: 'Documents',
        subcategory: 'Invoices',
        fileSize: 100
      })
    )
    expect((proposal.operations[0].payload as { sortBatchId?: string }).sortBatchId).toEqual(
      expect.any(String)
    )
  })

  it('should record Sort History when an approved sort move executes', async () => {
    const recordSortOperation = vi.fn()
    const apply = vi.fn(async () => {})
    const capability = registry({ apply, recordSortOperation }).get('sort_folder')!
    const proposal = await capability.plan(
      capability.params.parse({ folder: '/downloads', mode: 'move' }),
      ctx
    )
    if (proposal.kind !== 'plan') throw new Error('expected a plan')

    await capability.execute!(proposal.operations[0], ctx)

    expect(apply).toHaveBeenCalledOnce()
    expect(recordSortOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        sourcePath: '/downloads/invoice.pdf',
        destPath: '/downloads/Documents/Invoices/invoice.pdf',
        operationType: 'move',
        category: 'Documents',
        subcategory: 'Invoices',
        fileName: 'invoice.pdf',
        fileSize: 100
      })
    )
    expect(recordSortOperation.mock.calls[0][0].batchId).toEqual(
      (proposal.operations[0].payload as { sortBatchId: string }).sortBatchId
    )
  })

  it('should share one Sort History batch across every file in the plan', async () => {
    const proposal = await propose('sort_folder', { folder: '/downloads', mode: 'move' })
    if (proposal.kind !== 'plan') throw new Error('expected a plan')
    const batchIds = proposal.operations.map(
      (op) => (op.payload as { sortBatchId: string }).sortBatchId
    )
    expect(new Set(batchIds).size).toBe(1)
  })

  it('should carry an inverse that puts each file back where it came from', async () => {
    const proposal = await propose('sort_folder', { folder: '/downloads', mode: 'move' })

    if (proposal.kind !== 'plan') throw new Error('expected a plan')
    expect(proposal.operations[0].inverse).toEqual({
      kind: 'move',
      sourcePath: '/downloads/Documents/Invoices/invoice.pdf',
      targetPath: '/downloads/invoice.pdf'
    })
  })

  it('should propose copies when asked to copy', async () => {
    const proposal = await propose('sort_folder', { folder: '/downloads', mode: 'copy' })

    if (proposal.kind !== 'plan') throw new Error('expected a plan')
    expect(
      proposal.operations.every((op) => (op.payload as { kind: string }).kind === 'copy')
    ).toBe(true)
  })

  it('should invert a copy by trashing the copy, never touching the source', async () => {
    const proposal = await propose('sort_folder', { folder: '/downloads', mode: 'copy' })

    if (proposal.kind !== 'plan') throw new Error('expected a plan')
    const inverse = proposal.operations[0].inverse

    expect(inverse).toEqual({
      kind: 'trash',
      sourcePath: '/downloads/Documents/Invoices/invoice.pdf'
    })
    expect(Object.values(inverse as Record<string, unknown>)).not.toContain(
      '/downloads/invoice.pdf'
    )
  })

  it('should propose nothing when the folder holds no loose files', async () => {
    const proposal = await propose(
      'sort_folder',
      { folder: '/downloads' },
      { scanFolder: async () => [] }
    )

    if (proposal.kind !== 'plan') throw new Error('expected a plan')
    expect(proposal.operations).toEqual([])
    expect(proposal.summary).toContain('No loose files')
  })
})

describe('find_duplicates', () => {
  it('should propose trashing every copy but the first in each group', async () => {
    const proposal = await propose('find_duplicates', { folder: '/downloads' })

    if (proposal.kind !== 'plan') throw new Error('expected a plan')
    expect(proposal.operations).toHaveLength(1)
    expect(proposal.operations[0].payload).toEqual({
      kind: 'trash',
      sourcePath: '/downloads/a-copy.pdf'
    })
    expect(proposal.operations[0].reason).toContain('a.pdf')
  })

  it('should declare itself irreversible, because trashing cannot be undone', async () => {
    const capability = registry().get('find_duplicates')!

    expect(capability.effect.reversible).toBe(false)
    expect(capability.revert).toBeUndefined()
  })

  it('should never propose emptying a group entirely', async () => {
    const proposal = await propose(
      'find_duplicates',
      { folder: '/downloads' },
      { findDuplicateGroups: async () => [['/a.pdf', '/b.pdf', '/c.pdf']] }
    )

    if (proposal.kind !== 'plan') throw new Error('expected a plan')
    expect(proposal.operations).toHaveLength(2)
  })
})

describe('search_files', () => {
  it('should answer with matches rather than proposing a plan', async () => {
    const proposal = await propose('search_files', { query: 'invoice', limit: 20 })

    expect(proposal.kind).toBe('answer')
    if (proposal.kind !== 'answer') return
    expect(proposal.evidence).toHaveLength(1)
    expect(proposal.evidence[0].source).toBe('/downloads/invoice.pdf')
    expect(proposal.evidence[0].text).toContain('Amount due 1200')
    expect(proposal.card).toEqual({
      kind: 'paths',
      entries: [
        {
          path: '/downloads/invoice.pdf',
          label: 'invoice.pdf',
          snippet: 'Amount due 1200',
          isDirectory: false
        }
      ]
    })
  })

  it('should say so plainly when nothing matches', async () => {
    const proposal = await propose(
      'search_files',
      { query: 'nothing' },
      { searchFiles: async () => [] }
    )

    if (proposal.kind !== 'answer') throw new Error('expected an answer')
    expect(proposal.evidence).toEqual([])
    expect(proposal.summary).toContain('Nothing matches')
  })
})

describe('file capabilities execute through deps.apply', () => {
  it('should apply the payload on execute and the inverse on revert', async () => {
    const d = deps()
    const registry = new CapabilityRegistry(fileCapabilities(d))
    const sort = registry.get('sort_folder')!
    const op = {
      label: 'a → b',
      reason: '',
      payload: { kind: 'move', sourcePath: '/a', targetPath: '/b' },
      inverse: { kind: 'move', sourcePath: '/b', targetPath: '/a' }
    }
    await sort.execute!(op, ctx)
    await sort.revert!(op, ctx)
    expect(d.apply).toHaveBeenNthCalledWith(1, op.payload)
    expect(d.apply).toHaveBeenNthCalledWith(2, op.inverse)
  })

  it('should trash duplicates through deps.apply', async () => {
    const d = deps()
    const dup = new CapabilityRegistry(fileCapabilities(d)).get('find_duplicates')!
    await dup.execute!(
      { label: '/x', reason: '', payload: { kind: 'trash', sourcePath: '/x' }, inverse: null },
      ctx
    )
    expect(d.apply).toHaveBeenCalledWith({ kind: 'trash', sourcePath: '/x' })
  })
})

describe('the file capability set', () => {
  it('should register without tripping the inverse check', () => {
    expect(() => registry()).not.toThrow()
  })

  it('should mark only search_files as read-only', () => {
    const readOnly = registry()
      .all()
      .filter((c) => c.effect.world === 'reads')
      .map((c) => c.name)

    expect(readOnly).toEqual(['search_files'])
  })
})

describe('convert_file', () => {
  it('should propose the new file next to the original and trash it on undo', async () => {
    const d = deps()
    const cap = registry(d).get('convert_file')!
    const proposal = await cap.plan(
      cap.params.parse({ path: '/photos/IMG_1.HEIC', to: 'jpg' }),
      ctx
    )
    if (proposal.kind !== 'plan') throw new Error('expected plan')
    expect(proposal.summary).toBe('Convert IMG_1.HEIC to JPG')
    expect(proposal.operations[0]).toEqual({
      label: 'IMG_1.HEIC → IMG_1.jpg',
      reason: 'convert',
      payload: {
        kind: 'convert',
        sourcePath: '/photos/IMG_1.HEIC',
        targetPath: '/photos/IMG_1.jpg',
        format: 'jpg'
      },
      inverse: { kind: 'trash', sourcePath: '/photos/IMG_1.jpg' }
    })
    await cap.execute!(proposal.operations[0], ctx)
    expect(d.convertImage).toHaveBeenCalledWith('/photos/IMG_1.HEIC', '/photos/IMG_1.jpg', 'jpg')
    await cap.revert!(proposal.operations[0], ctx)
    expect(d.apply).toHaveBeenCalledWith({ kind: 'trash', sourcePath: '/photos/IMG_1.jpg' })
  })

  it('should answer instead of planning when the file already has that format', async () => {
    const cap = registry().get('convert_file')!
    const proposal = await cap.plan(cap.params.parse({ path: '/photos/a.jpg', to: 'jpg' }), ctx)
    expect(proposal.kind).toBe('answer')
    expect(proposal.summary).toBe('a.jpg is already a JPG')
  })

  it('should expand ~ against the home folder', async () => {
    const cap = registry().get('convert_file')!
    const proposal = await cap.plan(cap.params.parse({ path: '~/Desktop/x.png', to: 'pdf' }), ctx)
    if (proposal.kind !== 'plan') throw new Error('expected plan')
    expect(proposal.operations[0].payload).toMatchObject({
      sourcePath: '/Users/test/Desktop/x.png',
      targetPath: '/Users/test/Desktop/x.pdf'
    })
  })
})
