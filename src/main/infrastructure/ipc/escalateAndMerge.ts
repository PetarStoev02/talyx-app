import {
  extractEntitiesFromText,
  type PipelineProgress
} from '../../domain/classification/services/classificationPrompt'
import type { Category } from '../../domain/classification/model/Category'
import {
  readsContent,
  type TextExtractor
} from '../../domain/classification/services/TextExtractor'
import type {
  Sorter,
  SorterInput,
  SorterVerdict
} from '../../domain/classification/services/Sorter'
import type { ClassifiedFile } from '../../domain/sorting/services/SortExecutor'

/** Below this the sorter's answer is not trusted over the one Smart Local already gave. */
const MIN_CONFIDENCE = 0.7

/** How many files are read at once — matches the fingerprint pass in sort.ipc.ts. */
const EXTRACT_CONCURRENCY = 8

export interface EscalationCandidate {
  /** Smart Local's answer. Merged in place when a verdict is accepted. */
  file: ClassifiedFile
  /** The same file as the sorter would see it, including whatever text was read. */
  input: SorterInput
  /** False when the "text" is only a stat or EXIF summary the extractor wrote. */
  readContent: boolean
}

export interface EscalationOutcome {
  /** The files actually handed to the sorter. Everything else stayed here. */
  sent: EscalationCandidate[]
  /** The files a verdict was applied to, for the caller to remember in its cache. */
  applied: EscalationCandidate[]
}

/**
 * How many of these files would need reading — still useful for logging and
 * for UI that describes extraction, not for deciding whether Claude may see
 * a file. Answered from names alone, so the Smart Local path can report it
 * without opening anything.
 */
export function countEscalatable(files: ClassifiedFile[]): number {
  return files.filter((file) => readsContent(file.path)).length
}

/**
 * Decides what a sorter is allowed to see, then folds its verdicts back over
 * Smart Local's answers.
 *
 * Smart Local is handed nothing at all. Claude (and any other non-local
 * sorter) is handed every file in the batch — names, metadata, and extracted
 * text when available. Confidence decides only whether a verdict is
 * *believed*, never whether a file is *sent*.
 */
export async function escalateAndMerge(
  candidates: EscalationCandidate[],
  sorter: Sorter,
  language: string,
  onProgress?: (progress: PipelineProgress) => void
): Promise<EscalationOutcome> {
  if (sorter.id === 'smart-local') return { sent: [], applied: [] }

  const sent = candidates
  if (sent.length === 0) return { sent, applied: [] }

  const verdicts = await sorter.classify(
    sent.map((c) => c.input),
    language,
    onProgress
  )
  // The verdict list is compacted, so it is correlated by path — a deep scan
  // holds `2025/report.pdf` and `2026/report.pdf` at once, and a basename key
  // would give both of them whichever verdict came last.
  const byPath = new Map<string, SorterVerdict>(verdicts.map((v) => [v.path, v]))

  const applied: EscalationCandidate[] = []
  for (const candidate of sent) {
    const verdict = byPath.get(candidate.input.path)
    if (!verdict) continue
    const classification = candidate.file.classification
    if (verdict.confidence > MIN_CONFIDENCE) {
      classification.category = verdict.category as Category
      classification.subcategory = verdict.subcategory
      classification.confidence = verdict.confidence
      classification.semanticPath = verdict.subcategory
        ? [verdict.category, verdict.subcategory]
        : [verdict.category]
      applied.push(candidate)
    }
    // A rename is worth taking even from a verdict whose category was not.
    if (verdict.suggestedName) classification.suggestedName = verdict.suggestedName
  }
  return { sent, applied }
}

/**
 * Reads every file the cache could not answer. Extraction runs here rather
 * than inside a sorter so extracted text is already attached when Claude
 * (or another sorter) sees the batch.
 */
export async function readCandidates(
  files: ClassifiedFile[],
  textExtractor: TextExtractor | undefined,
  onRead?: (completed: number, file: ClassifiedFile) => void
): Promise<EscalationCandidate[]> {
  const candidates: EscalationCandidate[] = []
  let read = 0
  for (let i = 0; i < files.length; i += EXTRACT_CONCURRENCY) {
    const chunk = files.slice(i, i + EXTRACT_CONCURRENCY)
    const results = await Promise.all(chunk.map((file) => textExtractor?.extract(file.path)))
    chunk.forEach((file, j) => {
      const extractedText = results[j]?.text ?? ''
      candidates.push({
        file,
        readContent: results[j]?.readContent ?? false,
        input: {
          path: file.path,
          name: file.name,
          size: file.size,
          extensionHint: file.classification.category,
          extractedText,
          // Regexes, not a model: on this path only dates, amounts and company
          // names are ever found, so only those can be masked. Personal names
          // and locations are never populated here and go out verbatim —
          // whatever is said about this to an owner has to say that.
          entities: extractEntitiesFromText(extractedText, Infinity)
        }
      })
      read++
      onRead?.(read, file)
    })
  }
  return candidates
}
