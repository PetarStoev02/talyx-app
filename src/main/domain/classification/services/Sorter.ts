import type { PipelineProgress } from './classificationPrompt'
import type { ClassificationEntities } from './redactForClassification'

export type SorterId = 'smart-local' | 'claude'

export interface SorterInput {
  path: string
  name: string
  size: number
  /** The category Smart Local already settled on, as a hint. */
  extensionHint: string
  /** Text the extractor pulled out. Attached for quality when a sorter reads the batch. */
  extractedText: string
  entities: ClassificationEntities
}

export interface SorterVerdict {
  /** The input file's own path, which is what the caller correlates on. */
  path: string
  name: string
  category: string
  subcategory: string | null
  suggestedName: string | null
  confidence: number
}

export interface Sorter {
  readonly id: SorterId
  /**
   * The cache is invalidated per sorter, so this must change whenever the
   * model or prompt behind it changes.
   */
  readonly engineVersion: string
  /**
   * The returned array is compacted: a sorter that has nothing to say about
   * a file (see `SmartLocalSorter`) or that only got a partial match back
   * from its model omits that file rather than padding the array, so its
   * length and order do not correspond to `files`. Correlate verdicts back
   * to input files by `path`, never by index and never by `name` — a deep
   * scan routinely holds two files with the same basename in different
   * subfolders. `path` and `name` are always the input file's own, never
   * whatever the model echoed back.
   */
  classify(
    files: SorterInput[],
    language: string,
    onProgress?: (progress: PipelineProgress) => void
  ): Promise<SorterVerdict[]>
}

/**
 * Smart Local (extension + metadata) has already run by the time a sorter is
 * asked, so this one has nothing to add. It exists so the caller never
 * branches on null.
 */
export class SmartLocalSorter implements Sorter {
  readonly id: SorterId = 'smart-local'
  readonly engineVersion = 'smart-local'

  async classify(): Promise<SorterVerdict[]> {
    return []
  }
}
