import log from 'electron-log'
import {
  parseCoordinatorResponse,
  matchResultsByFileName,
  type CoordinatorResult,
  type PipelineProgress
} from './classificationPrompt'
import type { AssistantReply, ModelProvider } from '../../agent/ModelProvider'
import { CATEGORIES, SUBCATEGORIES, rehomeSubcategory } from '../model/Category'
import { redactForClassification } from './redactForClassification'
import type { Sorter, SorterId, SorterInput, SorterVerdict } from './Sorter'

const TAXONOMY_LISTING = CATEGORIES.map(
  (category) =>
    `- ${category}: ${SUBCATEGORIES[category].map((sub) => `${category}/${sub}`).join(', ')}`
).join('\n')

/**
 * How many files one request may ask about. Sized off the reply, which is what
 * the 8192-token output cap bites: a worst-case line — a 255-char fileName, a
 * 50-char suggestedName and the fixed JSON keys — is under 400 characters, so
 * ~130 tokens, and 25 of them is ~3.3k. That leaves well over half the cap for
 * a preamble or reasoning tokens, so a full batch never runs into it. The
 * input side is not the constraint: 25 x (2000 chars of text + header) is
 * ~15k tokens against a 200k window.
 *
 * The cap is an output-token budget, not an attention one, so it can sit well
 * above what a small local model could juggle.
 */
const MAX_FILES_PER_REQUEST = 25

/**
 * Sorts with the owner's own Claude (API key or signed-in Claude Code) as the
 * classifier. The prompt spells out every allowed
 * category/subcategory pair, so an invoice lands in Documents/Invoices instead
 * of a looser Documents/Reports.
 */
export class ClaudeSorter implements Sorter {
  readonly id: SorterId = 'claude'
  readonly engineVersion: string

  constructor(
    private provider: ModelProvider,
    modelId: string
  ) {
    this.engineVersion = `claude:${modelId}`
  }

  async classify(
    files: SorterInput[],
    language: string,
    onProgress?: (progress: PipelineProgress) => void
  ): Promise<SorterVerdict[]> {
    const verdicts: SorterVerdict[] = []
    for (let start = 0; start < files.length; start += MAX_FILES_PER_REQUEST) {
      const batch = files.slice(start, start + MAX_FILES_PER_REQUEST)
      onProgress?.({
        phase: 'classifying-ai',
        completed: start,
        total: files.length,
        currentFile: batch
          .map((f) => f.name)
          .slice(0, 3)
          .join(', ')
      })
      verdicts.push(...(await this.classifyBatch(batch, language)))
    }
    return verdicts
  }

  /** One request. A batch that fails contributes nothing and never stops the rest. */
  private async classifyBatch(files: SorterInput[], language: string): Promise<SorterVerdict[]> {
    let reply: AssistantReply
    try {
      const prompt = buildPrompt(files, language)
      reply = await this.provider.complete(
        [{ role: 'user', text: prompt }],
        [],
        new AbortController().signal
      )
    } catch (err) {
      // Losing the Claude pass leaves Smart Local's answer standing — a
      // worse sort, never a broken preview.
      log.warn('[ClaudeSorter] Provider failed:', err instanceof Error ? err.message : err)
      return []
    }

    if (reply.stopReason === 'max_tokens') {
      // The JSON array stops mid-object, so parsing it yields either nothing or
      // a truncated verdict for the files that happened to come first. Neither
      // is worth filing an owner's documents on.
      log.warn(`[ClaudeSorter] Reply hit the output cap for ${files.length} files — discarding it`)
      return []
    }

    const parsed = parseCoordinatorResponse(reply.text)
    const matched = matchResultsByFileName(
      parsed,
      files.map((f) => f.name)
    )

    // Parsing the reply a second time is only worth it for the rare file the
    // shared coercion gave up on — computed at most once per batch.
    let rawSubcategories: Map<CoordinatorResult, string | null> | null = null
    const rawSubcategoryOf = (result: CoordinatorResult): string | null => {
      rawSubcategories ??= rawSubcategoriesByResult(parsed, reply.text)
      return rawSubcategories.get(result) ?? null
    }

    const verdicts: SorterVerdict[] = []
    for (let i = 0; i < files.length; i++) {
      const result = matched.get(i)
      if (!result) continue
      const { category, subcategory } = rehomeIfUnresolved(result, rawSubcategoryOf)
      // Always the input file's own path and name — the model may echo a
      // differently cased or reordered fileName, and matchResultsByFileName's
      // job is precisely to rescue those replies. Keying on the echo instead
      // of the input would make the caller's own correlation drop them.
      verdicts.push({
        path: files[i].path,
        name: files[i].name,
        category,
        subcategory,
        suggestedName: result.suggestedName,
        confidence: result.confidence
      })
    }
    return verdicts
  }
}

/**
 * `coerceToTaxonomy` (via `parseCoordinatorResponse`) only rehomes an invalid
 * category by matching the CATEGORY text against known subcategory names —
 * that behaviour is shared with the other classifiers and must stay
 * unchanged. Claude is told the taxonomy explicitly, so it sometimes gets the
 * category wrong (`Finance`) while still naming a real subcategory
 * (`Invoices`); this is the Claude-only second attempt, applied only when the
 * shared coercion already gave up (`Other`/`Other`). `'Other'` is excluded —
 * it names a subcategory of every category, so rehoming on it would move a
 * genuinely uncategorizable file into `Documents` instead of leaving it at
 * `Other`/`Other`.
 */
function rehomeIfUnresolved(
  result: CoordinatorResult,
  getRawSubcategory: (result: CoordinatorResult) => string | null
): { category: string; subcategory: string | null } {
  const isUnresolved = result.category === 'Other' && result.subcategory === 'Other'
  const rawSubcategory = isUnresolved ? getRawSubcategory(result) : null
  if (!isUnresolved || !rawSubcategory || rawSubcategory.trim().toLowerCase() === 'other') {
    return { category: result.category, subcategory: result.subcategory }
  }
  return (
    rehomeSubcategory(rawSubcategory) ?? {
      category: result.category,
      subcategory: result.subcategory
    }
  )
}

/**
 * The model's own subcategory text before coercion discards it, keyed by the
 * very result object `matchResultsByFileName` hands back. Correlated by
 * position — `parseCoordinatorResponse` maps the reply array one-for-one — and
 * never by the echoed fileName: a deep scan holds `2025/report.pdf` and
 * `2026/report.pdf` at once, and a basename key would give both of them
 * whichever raw subcategory came last.
 */
function rawSubcategoriesByResult(
  parsed: CoordinatorResult[],
  raw: string
): Map<CoordinatorResult, string | null> {
  const rawSubcategories = new Map<CoordinatorResult, string | null>()
  try {
    let cleaned = raw.trim()
    const codeBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    if (codeBlockMatch) cleaned = codeBlockMatch[1].trim()
    const items: unknown = JSON.parse(cleaned)
    if (!Array.isArray(items)) return rawSubcategories
    parsed.forEach((result, i) => {
      const item = items[i] as Record<string, unknown> | undefined
      rawSubcategories.set(result, item?.subcategory ? String(item.subcategory) : null)
    })
  } catch {
    // parseCoordinatorResponse already logs the parse failure; nothing to add.
  }
  return rawSubcategories
}

function buildPrompt(files: SorterInput[], language: string): string {
  const fileBlocks = files
    .map((file, i) => {
      const text = redactForClassification(file.extractedText, file.entities)
      const lines = [
        `[${i + 1}] name: "${file.name}"`,
        `size: ${file.size} bytes`,
        `extension hint: ${file.extensionHint}`
      ]
      if (text) lines.push(`text: "${text}"`)
      return lines.join('\n')
    })
    .join('\n---\n')

  return `Classify each file into exactly one of the allowed category/subcategory pairs below. Judge by the extracted text, not the filename. Any category or subcategory outside this list is invalid.

Allowed category/subcategory pairs:
${TAXONOMY_LISTING}

Respond in ${language} for suggestedName. Rename each file to a descriptive-name_YYYYMMDD.ext (max 50 chars) that is never the original filename.

FILES:
${fileBlocks}

Respond with a JSON array only, no explanation:
[{"fileName":"original.ext","category":"Cat","subcategory":"Sub","suggestedName":"new-name.ext","confidence":0.9}]`
}
