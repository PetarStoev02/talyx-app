import type { SearchIndexRepo } from '../repository/SearchIndexRepo'
import type { TextExtractor } from '../../classification/services/TextExtractor'
import type { ExtensionClassifier } from '../../classification/services/ExtensionClassifier'
import log from 'electron-log'

interface ScanProgress {
  current: number
  total: number
  currentFile: string
  phase: 'discovering' | 'indexing' | 'complete'
}

interface FileToScan {
  path: string
  name: string
  category: string
}

/**
 * Deep Scan Service — Indexes files using text extraction.
 *
 * Pipeline:
 * 1. TextExtractor handles Documents (PDF, DOCX, etc.)
 * 2. All other files indexed by filename + category metadata
 * 3. Results stored in FTS5 for instant keyword search
 */
export class DeepScanService {
  constructor(
    private searchIndex: SearchIndexRepo,
    private textExtractor: TextExtractor,
    private extensionClassifier: ExtensionClassifier
  ) {}

  async scan(
    files: Array<{ path: string; name: string }>,
    onProgress?: (p: ScanProgress) => void
  ): Promise<{ indexed: number; total: number }> {
    const total = files.length
    let indexed = 0

    // Classify files by type
    const documents: FileToScan[] = []
    const other: FileToScan[] = []

    for (const file of files) {
      const result = this.extensionClassifier.classify(file.name)
      const entry = { ...file, category: result.category }

      if (result.category === 'Documents') {
        documents.push(entry)
      } else {
        other.push(entry)
      }
    }

    log.info(`Deep scan: ${documents.length} docs, ${other.length} other`)

    // Process documents with text extraction, others by metadata
    const results = await Promise.allSettled([
      this.indexDocuments(documents, (n, file) => {
        indexed += n
        onProgress?.({ current: indexed, total, currentFile: file, phase: 'indexing' })
      }),
      this.indexOther(other, (n, file) => {
        indexed += n
        onProgress?.({ current: indexed, total, currentFile: file, phase: 'indexing' })
      })
    ])

    for (const r of results) {
      if (r.status === 'rejected') {
        log.error('Scan worker failed:', r.reason)
      }
    }

    onProgress?.({ current: total, total, currentFile: '', phase: 'complete' })
    return { indexed, total }
  }

  /** Extract text from documents (PDF, DOCX, etc.) */
  private async indexDocuments(
    files: FileToScan[],
    onFile: (count: number, name: string) => void
  ): Promise<void> {
    for (const file of files) {
      try {
        const extraction = await this.textExtractor.extract(file.path)
        if (extraction.text.length > 0) {
          this.searchIndex.indexContent(file.path, extraction.text, 'text', 'unknown')
        } else {
          this.indexByMetadata(file)
        }
      } catch {
        this.indexByMetadata(file)
      }
      onFile(1, file.name)
    }
  }

  /** Index files by filename + category metadata */
  private async indexOther(
    files: FileToScan[],
    onFile: (count: number, name: string) => void
  ): Promise<void> {
    for (const file of files) {
      this.indexByMetadata(file)
      onFile(1, file.name)
    }
  }

  private indexByMetadata(file: FileToScan): void {
    const text = `${file.name} ${file.category}`
    this.searchIndex.indexContent(file.path, text, 'metadata', 'unknown')
  }
}
