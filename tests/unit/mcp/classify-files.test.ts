import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, writeFile, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { buildSortPlan } from '../../../src/main/mcp/tools/classify-files'

describe('buildSortPlan', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'mcp-classify-'))
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('should build a plan from AI classifications', async () => {
    const filePath = join(tempDir, 'report.pdf')
    await writeFile(filePath, 'fake pdf content')

    const { plan, skipped } = await buildSortPlan([
      {
        path: filePath,
        category: 'Documents',
        subcategory: 'Reports',
        suggestedName: null
      }
    ])

    expect(plan).toHaveLength(1)
    expect(skipped).toHaveLength(0)
    expect(plan[0].category).toBe('Documents')
    expect(plan[0].subcategory).toBe('Reports')
    expect(plan[0].semanticPath).toBe(join('Documents', 'Reports'))
    expect(plan[0].name).toBe('report.pdf')
  })

  it('should skip nonexistent files', async () => {
    const existingPath = join(tempDir, 'exists.txt')
    await writeFile(existingPath, 'real file')

    const { plan, skipped } = await buildSortPlan([
      {
        path: existingPath,
        category: 'Documents',
        subcategory: null,
        suggestedName: null
      },
      {
        path: join(tempDir, 'missing.txt'),
        category: 'Documents',
        subcategory: null,
        suggestedName: null
      }
    ])

    expect(plan).toHaveLength(1)
    expect(plan[0].name).toBe('exists.txt')
    expect(skipped).toHaveLength(1)
    expect(skipped[0]).toContain('missing.txt')
  })

  it('should use category only when subcategory is null', async () => {
    const filePath = join(tempDir, 'file.txt')
    await writeFile(filePath, 'content')

    const { plan } = await buildSortPlan([
      {
        path: filePath,
        category: 'Documents',
        subcategory: null,
        suggestedName: null
      }
    ])

    expect(plan[0].semanticPath).toBe('Documents')
  })

  it('should preserve suggested names', async () => {
    const filePath = join(tempDir, 'IMG_1234.jpg')
    await writeFile(filePath, Buffer.alloc(100))

    const { plan } = await buildSortPlan([
      {
        path: filePath,
        category: 'Images',
        subcategory: 'Photos',
        suggestedName: 'vacation-beach-2024.jpg'
      }
    ])

    expect(plan[0].suggestedName).toBe('vacation-beach-2024.jpg')
  })

  it('should return empty plan for empty input', async () => {
    const { plan, skipped } = await buildSortPlan([])
    expect(plan).toEqual([])
    expect(skipped).toEqual([])
  })
})
