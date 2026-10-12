import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ClassificationPipeline } from '../../../src/main/domain/classification/services/ClassificationPipeline'
import type { ExtensionClassifier } from '../../../src/main/domain/classification/services/ExtensionClassifier'
import type { MetadataClassifier } from '../../../src/main/domain/classification/services/MetadataClassifier'

function createMockExtClassifier(
  category = 'Documents',
  subcategory = 'General'
): ExtensionClassifier {
  return {
    classify: vi.fn().mockReturnValue({
      category,
      subcategory,
      confidence: 0.8,
      metadata: { extension: 'pdf' }
    })
  } as unknown as ExtensionClassifier
}

function createMockMetaClassifier(): MetadataClassifier {
  return {
    classify: vi.fn().mockResolvedValue({
      subcategory: null,
      metadata: {}
    })
  } as unknown as MetadataClassifier
}

describe('ClassificationPipeline', () => {
  let pipeline: ClassificationPipeline

  beforeEach(() => {
    pipeline = new ClassificationPipeline(createMockExtClassifier(), createMockMetaClassifier())
  })

  it('should classify a document using extension + metadata', async () => {
    const result = await pipeline.classify('/test/portfolio.pdf')

    expect(result.category).toBe('Documents')
    expect(result.subcategory).toBe('General')
    expect(result.confidence).toBe(0.8)
  })

  it('should set semanticPath from extension result', async () => {
    const result = await pipeline.classify('/test/portfolio.pdf')

    expect(result.semanticPath).toEqual(['Documents', 'General'])
  })

  it('should respect custom rules (highest priority)', async () => {
    pipeline.setCustomRules([{ extension: 'psd', category: 'Design', subcategory: 'Photoshop' }])

    const result = await pipeline.classify('/test/mockup.psd')
    expect(result.category).toBe('Design')
    expect(result.subcategory).toBe('Photoshop')
  })

  it('should merge metadata from extension and metadata classifiers', async () => {
    const metaClassifier = {
      classify: vi.fn().mockResolvedValue({
        subcategory: null,
        metadata: { width: 1920, height: 1080 }
      })
    } as unknown as MetadataClassifier

    pipeline = new ClassificationPipeline(
      createMockExtClassifier('Images', 'Photos'),
      metaClassifier
    )

    const result = await pipeline.classify('/test/photo.jpg')
    expect(result.metadata.width).toBe(1920)
  })

  it('should classify audio files correctly', async () => {
    pipeline = new ClassificationPipeline(
      createMockExtClassifier('Audio', 'Music'),
      createMockMetaClassifier()
    )

    const result = await pipeline.classify('/test/song.mp3')
    expect(result.category).toBe('Audio')
    expect(result.subcategory).toBe('Music')
  })

  it('should classify files sequentially via classifyFiles', async () => {
    const files = [
      { path: '/test/a.pdf', name: 'a.pdf', size: 100 },
      { path: '/test/b.pdf', name: 'b.pdf', size: 200 }
    ]

    const results = await pipeline.classifyFiles(files)
    expect(results).toHaveLength(2)
    expect(results[0].classification.category).toBe('Documents')
    expect(results[1].classification.category).toBe('Documents')
  })
})
