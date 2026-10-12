import { describe, it, expect } from 'vitest'
import {
  countEscalatable,
  escalateAndMerge,
  readCandidates,
  type EscalationCandidate
} from '../../../src/main/infrastructure/ipc/escalateAndMerge'
import type {
  ExtractionResult,
  TextExtractor
} from '../../../src/main/domain/classification/services/TextExtractor'
import type { ClassifiedFile } from '../../../src/main/domain/sorting/services/SortExecutor'
import type {
  Sorter,
  SorterId,
  SorterInput,
  SorterVerdict
} from '../../../src/main/domain/classification/services/Sorter'
import type { Category } from '../../../src/main/domain/classification/model/Category'

const noEntities = { dates: [], names: [], amounts: [], organizations: [], locations: [] }

interface RecordingSorter extends Sorter {
  /** One entry per classify() call, so "sent nothing" is `[]` and not `[[]]`. */
  calls: SorterInput[][]
}

function recordingSorter(verdicts: SorterVerdict[] = [], id: SorterId = 'claude'): RecordingSorter {
  const calls: SorterInput[][] = []
  return {
    id,
    engineVersion: `${id}:test`,
    calls,
    async classify(files) {
      calls.push(files)
      return verdicts
    }
  }
}

function candidate(
  name: string,
  extractedText: string,
  readContent = extractedText.trim().length > 0,
  dir = '/tmp'
): EscalationCandidate {
  return {
    readContent,
    file: {
      path: `${dir}/${name}`,
      name,
      size: 10,
      classification: {
        category: 'Other' as Category,
        subcategory: null,
        confidence: 0.4,
        suggestedName: null,
        semanticPath: ['Other'],
        metadata: {}
      }
    },
    input: {
      path: `${dir}/${name}`,
      name,
      size: 10,
      extensionHint: 'Other',
      extractedText,
      entities: noEntities
    }
  }
}

function verdict(name: string, overrides: Partial<SorterVerdict> = {}): SorterVerdict {
  return {
    path: `/tmp/${name}`,
    name,
    category: 'Documents',
    subcategory: 'Invoices',
    suggestedName: 'acme-invoice_20260701.pdf',
    confidence: 0.9,
    ...overrides
  }
}

describe('escalation', () => {
  it('should send a file with no extracted text when Claude sorts the batch', async () => {
    const sorter = recordingSorter()
    const outcome = await escalateAndMerge([candidate('song.mp3', '')], sorter, 'en')
    expect(sorter.calls[0].map((f) => f.name)).toEqual(['song.mp3'])
    expect(outcome.sent).toHaveLength(1)
  })

  it('should send a file whose contents were read', async () => {
    const sorter = recordingSorter()
    await escalateAndMerge([candidate('scan.pdf', 'Invoice 44616')], sorter, 'en')
    expect(sorter.calls[0].map((f) => f.name)).toEqual(['scan.pdf'])
  })

  it('should send every file in a mixed Claude batch', async () => {
    const sorter = recordingSorter()
    const outcome = await escalateAndMerge(
      [candidate('a.mp3', ''), candidate('scan.pdf', 'Invoice 44616'), candidate('b.dmg', '  ')],
      sorter,
      'en'
    )
    expect(sorter.calls[0].map((f) => f.name)).toEqual(['a.mp3', 'scan.pdf', 'b.dmg'])
    expect(outcome.sent.map((c) => c.input.name)).toEqual(['a.mp3', 'scan.pdf', 'b.dmg'])
  })

  it('should send nothing anywhere when the owner sorts with Smart Local', async () => {
    const sorter = recordingSorter([], 'smart-local')
    const outcome = await escalateAndMerge([candidate('scan.pdf', 'Invoice 44616')], sorter, 'en')
    expect(sorter.calls).toEqual([])
    expect(outcome.sent).toEqual([])
    expect(outcome.applied).toEqual([])
  })
})

describe('merging a verdict over Smart Local', () => {
  it('should take a confident verdict and report the file as applied', async () => {
    const scan = candidate('scan.pdf', 'Invoice 44616')
    const sorter = recordingSorter([verdict('scan.pdf')])
    const outcome = await escalateAndMerge([scan], sorter, 'en')
    expect(scan.file.classification.category).toBe('Documents')
    expect(scan.file.classification.subcategory).toBe('Invoices')
    expect(scan.file.classification.semanticPath).toEqual(['Documents', 'Invoices'])
    expect(scan.file.classification.suggestedName).toBe('acme-invoice_20260701.pdf')
    expect(outcome.applied.map((c) => c.input.name)).toEqual(['scan.pdf'])
  })

  it('should keep Smart Local’s category when the verdict is not confident', async () => {
    const scan = candidate('scan.pdf', 'Invoice 44616')
    const sorter = recordingSorter([verdict('scan.pdf', { confidence: 0.5 })])
    const outcome = await escalateAndMerge([scan], sorter, 'en')
    expect(scan.file.classification.category).toBe('Other')
    // The rename is the sorter's to give even when its category is not trusted.
    expect(scan.file.classification.suggestedName).toBe('acme-invoice_20260701.pdf')
    expect(outcome.applied).toEqual([])
  })

  it('should correlate a compacted verdict list by path and not by position', async () => {
    const first = candidate('a.pdf', 'some text')
    const second = candidate('b.pdf', 'more text')
    const sorter = recordingSorter([verdict('b.pdf')])
    await escalateAndMerge([first, second], sorter, 'en')
    expect(first.file.classification.category).toBe('Other')
    expect(second.file.classification.category).toBe('Documents')
  })

  it('should give two files with the same basename their own verdict', async () => {
    const annual = candidate('report.pdf', 'Annual report 2025', true, '/docs/2025')
    const invoice = candidate('report.pdf', 'Invoice 44616', true, '/docs/2026')
    const sorter = recordingSorter([
      verdict('report.pdf', {
        path: '/docs/2025/report.pdf',
        subcategory: 'Reports',
        suggestedName: 'annual-report_20251231.pdf'
      }),
      verdict('report.pdf', { path: '/docs/2026/report.pdf' })
    ])
    await escalateAndMerge([annual, invoice], sorter, 'en')
    expect(annual.file.classification.subcategory).toBe('Reports')
    expect(annual.file.classification.suggestedName).toBe('annual-report_20251231.pdf')
    expect(invoice.file.classification.subcategory).toBe('Invoices')
    expect(invoice.file.classification.suggestedName).toBe('acme-invoice_20260701.pdf')
  })

  it('should leave every file alone when the sorter answered with nothing', async () => {
    const scan = candidate('scan.pdf', 'Invoice 44616')
    const outcome = await escalateAndMerge([scan], recordingSorter([]), 'en')
    expect(scan.file.classification.category).toBe('Other')
    expect(scan.file.classification.suggestedName).toBeNull()
    expect(outcome.applied).toEqual([])
  })
})

describe('Claude sorts the whole batch', () => {
  /** What TextExtractor writes for a JPG it could read EXIF but no text from. */
  function imageWithGps(name: string): EscalationCandidate {
    return candidate(
      name,
      'Camera: Apple iPhone 15\nGPS: 42.6977, 23.3219\nAuthor: Petar Stoev',
      false
    )
  }

  it('should send an image whose only text is its EXIF', async () => {
    const sorter = recordingSorter()
    const outcome = await escalateAndMerge([imageWithGps('holiday.jpg')], sorter, 'en')
    expect(sorter.calls[0].map((f) => f.name)).toEqual(['holiday.jpg'])
    expect(outcome.sent).toHaveLength(1)
  })

  it('should send a placeholder alongside a document that was read', async () => {
    const sorter = recordingSorter()
    await escalateAndMerge(
      [imageWithGps('holiday.jpg'), candidate('scan.pdf', 'Invoice 44616')],
      sorter,
      'en'
    )
    expect(sorter.calls[0].map((f) => f.name)).toEqual(['holiday.jpg', 'scan.pdf'])
  })

  it('should hand Claude every file, read or not', async () => {
    const sorter = recordingSorter([], 'claude')
    await escalateAndMerge(
      [candidate('notes.ts', ''), candidate('scan.pdf', 'Invoice 44616')],
      sorter,
      'en'
    )
    expect(sorter.calls[0].map((f) => f.name)).toEqual(['notes.ts', 'scan.pdf'])
  })
})

describe('how many files needed reading', () => {
  const filesNamed = (...names: string[]): ClassifiedFile[] =>
    names.map((name) => candidate(name, '').file)

  it('should report the documents in a mixed folder without opening one', () => {
    expect(countEscalatable(filesNamed('invoice.pdf', 'song.mp3', 'notes.txt'))).toBe(2)
  })

  it('should report none for a folder that is all music', () => {
    expect(countEscalatable(filesNamed('a.mp3', 'b.mp3', 'c.flac'))).toBe(0)
  })

  it('should report a scanned PDF that would be opened', () => {
    expect(countEscalatable(filesNamed('scan.pdf'))).toBe(1)
  })

  it('should report none for a folder of images', () => {
    expect(countEscalatable(filesNamed('holiday.jpg', 'shot.png', 'icon.svg'))).toBe(0)
  })
})

describe('a sorter nobody has met yet', () => {
  it('should hand an unknown sorter every file in the batch', async () => {
    const sorter = recordingSorter([], 'some-future-remote-model' as SorterId)
    await escalateAndMerge(
      [candidate('notes.ts', ''), candidate('scan.pdf', 'Invoice 44616')],
      sorter,
      'en'
    )
    expect(sorter.calls[0].map((f) => f.name)).toEqual(['notes.ts', 'scan.pdf'])
  })
})

describe('reading the files a sorter may see', () => {
  function classifiedFile(name: string): ClassifiedFile {
    return candidate(name, '').file
  }

  function extractorReturning(result: Partial<ExtractionResult>): TextExtractor {
    return {
      extract: async (): Promise<ExtractionResult> => ({
        text: '',
        metadata: {},
        truncated: false,
        readContent: true,
        ...result
      })
    } as unknown as TextExtractor
  }

  it('should find every amount a redaction has to mask, past the local prompt cap', async () => {
    const extractor = extractorReturning({
      text: 'Total: $1,200.00 then $34.50 then $99.99 then $7.00 then $12.34 due'
    })
    const [read] = await readCandidates([classifiedFile('invoice.pdf')], extractor)
    expect(read.input.entities.amounts).toEqual([
      '$1,200.00',
      '$34.50',
      '$99.99',
      '$7.00',
      '$12.34'
    ])
  })

  it('should carry the extractor’s verdict on whether it read anything', async () => {
    const extractor = extractorReturning({ text: 'Image file, size: 412KB', readContent: false })
    const [read] = await readCandidates([classifiedFile('screenshot.png')], extractor)
    expect(read.readContent).toBe(false)
  })

  it('should read nothing when no extractor is wired', async () => {
    const [read] = await readCandidates([classifiedFile('invoice.pdf')], undefined)
    expect(read.input.extractedText).toBe('')
    expect(read.readContent).toBe(false)
  })
})
