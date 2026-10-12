import path from 'node:path'
import type { EnhancedClassificationResult } from '../model/ClassificationResult'
import type { Category } from '../model/Category'
import type { ExtensionClassifier } from './ExtensionClassifier'
import type { MetadataClassifier } from './MetadataClassifier'

export interface CustomRule {
  extension: string
  category: string
  subcategory: string | null
}

export class ClassificationPipeline {
  private customRules: CustomRule[] = []

  constructor(
    private extensionClassifier: ExtensionClassifier,
    private metadataClassifier: MetadataClassifier
  ) {}

  setCustomRules(rules: CustomRule[]): void {
    this.customRules = rules
  }

  async classify(filePath: string): Promise<EnhancedClassificationResult> {
    const fileName = path.basename(filePath)

    // Stage 0: Check custom user rules (highest priority)
    const customMatch = this.matchCustomRule(fileName)
    if (customMatch) return customMatch

    // Stage 1: Extension detection (instant, always runs)
    const extResult = this.extensionClassifier.classify(fileName)

    // Stage 2: Metadata extraction (images, audio)
    const metaResult = await this.metadataClassifier.classify(filePath, extResult.category)

    // Build semantic path for folder structure
    const semanticPath: string[] = [extResult.category]
    if (extResult.subcategory) semanticPath.push(extResult.subcategory)

    return {
      category: extResult.category as Category,
      subcategory: extResult.subcategory,
      confidence: extResult.confidence,
      suggestedName: null,
      metadata: {
        ...extResult.metadata,
        ...metaResult.metadata
      },
      semanticPath
    }
  }

  async classifyFiles(files: Array<{ path: string; name: string; size: number }>): Promise<
    Array<{
      path: string
      name: string
      size: number
      classification: EnhancedClassificationResult
    }>
  > {
    const results: Array<{
      path: string
      name: string
      size: number
      classification: EnhancedClassificationResult
    }> = []
    for (const file of files) {
      const classification = await this.classify(file.path)
      results.push({ ...file, classification })
    }
    return results
  }

  private matchCustomRule(fileName: string): EnhancedClassificationResult | null {
    const lastDot = fileName.lastIndexOf('.')
    if (lastDot === -1) return null
    const ext = fileName.slice(lastDot + 1).toLowerCase()

    for (const rule of this.customRules) {
      if (rule.extension.toLowerCase() === ext) {
        return {
          category: rule.category as Category,
          subcategory: rule.subcategory,
          confidence: 1.0,
          metadata: { extension: ext, source: 'custom-rule' }
        }
      }
    }
    return null
  }
}
