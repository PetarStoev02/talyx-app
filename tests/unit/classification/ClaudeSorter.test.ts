import { describe, it, expect } from 'vitest'
import { ClaudeSorter } from '../../../src/main/domain/classification/services/ClaudeSorter'
import type { PipelineProgress } from '../../../src/main/domain/classification/services/classificationPrompt'
import type { ModelProvider, AssistantReply } from '../../../src/main/domain/agent/ModelProvider'
import type { SorterInput } from '../../../src/main/domain/classification/services/Sorter'

function providerReturning(text: string): ModelProvider & { seen: string[] } {
  const seen: string[] = []
  return {
    seen,
    async complete(messages): Promise<AssistantReply> {
      for (const m of messages) if ('text' in m) seen.push(m.text)
      return { text, toolCalls: [], stopReason: 'end_turn', refusalExplanation: null, raw: null }
    }
  }
}

function providerThrowing(error: Error): ModelProvider & { seen: string[] } {
  return {
    seen: [],
    async complete(): Promise<AssistantReply> {
      throw error
    }
  }
}

/** One reply per request, so a batch can succeed after another one failed. */
function providerReplying(
  replies: Array<Partial<AssistantReply> & { text: string }>
): ModelProvider & { prompts: string[] } {
  const prompts: string[] = []
  return {
    prompts,
    async complete(messages): Promise<AssistantReply> {
      for (const m of messages) if ('text' in m) prompts.push(m.text)
      const reply = replies[prompts.length - 1] ?? { text: '[]' }
      return {
        toolCalls: [],
        stopReason: 'end_turn',
        refusalExplanation: null,
        raw: null,
        ...reply
      }
    }
  }
}

/** `count` readable documents, named so a reply can be written for any slice of them. */
function documents(count: number): SorterInput[] {
  return Array.from({ length: count }, (_, i) => ({
    path: `/tmp/doc-${i}.pdf`,
    name: `doc-${i}.pdf`,
    size: 1000,
    extensionHint: 'Documents',
    extractedText: `Document number ${i}`,
    entities: { dates: [], names: [], amounts: [], organizations: [], locations: [] }
  }))
}

function replyFor(files: SorterInput[]): string {
  return JSON.stringify(
    files.map((f) => ({
      fileName: f.name,
      category: 'Documents',
      subcategory: 'Reports',
      suggestedName: null,
      confidence: 0.9
    }))
  )
}

const file = {
  path: '/tmp/invoice-0000044616.pdf',
  name: 'invoice-0000044616.pdf',
  size: 50851,
  extensionHint: 'Documents',
  extractedText: 'Invoice 44616 from Acme Ltd. Total 1200.00 EUR',
  entities: {
    dates: [],
    names: [],
    amounts: ['1200.00 EUR'],
    organizations: ['Acme Ltd'],
    locations: []
  }
}

describe('ClaudeSorter', () => {
  it('should file an invoice under Documents/Invoices', async () => {
    const provider = providerReturning(
      '[{"fileName":"invoice-0000044616.pdf","category":"Documents","subcategory":"Invoices","suggestedName":null,"confidence":0.95}]'
    )
    const verdicts = await new ClaudeSorter(provider, 'sonnet').classify([file], 'en')
    expect(verdicts[0].category).toBe('Documents')
    expect(verdicts[0].subcategory).toBe('Invoices')
  })

  it('should never put a raw entity in the prompt', async () => {
    const provider = providerReturning('[]')
    await new ClaudeSorter(provider, 'sonnet').classify([file], 'en')
    const prompt = provider.seen.join('\n')
    expect(prompt).not.toContain('Acme Ltd')
    expect(prompt).not.toContain('1200.00 EUR')
    expect(prompt).toContain('[ORG]')
  })

  it('should coerce a category outside the taxonomy', async () => {
    const provider = providerReturning(
      '[{"fileName":"invoice-0000044616.pdf","category":"Finance","subcategory":"Invoices","suggestedName":null,"confidence":0.9}]'
    )
    const verdicts = await new ClaudeSorter(provider, 'sonnet').classify([file], 'en')
    expect(verdicts[0].category).toBe('Documents')
    expect(verdicts[0].subcategory).toBe('Invoices')
  })

  it('should return no verdicts when the reply is not JSON', async () => {
    const provider = providerReturning('I could not read that file, sorry.')
    expect(await new ClaudeSorter(provider, 'sonnet').classify([file], 'en')).toEqual([])
  })

  it('should return no verdicts for an empty batch without calling the model', async () => {
    const provider = providerReturning('[]')
    expect(await new ClaudeSorter(provider, 'sonnet').classify([], 'en')).toEqual([])
    expect(provider.seen).toEqual([])
  })

  it('should carry the model in its engine version so the cache can tell them apart', () => {
    expect(new ClaudeSorter(providerReturning('[]'), 'sonnet').engineVersion).toBe('claude:sonnet')
  })

  it('should return no verdicts when the provider throws', async () => {
    const provider = providerThrowing(new Error('claude code not signed in'))
    expect(await new ClaudeSorter(provider, 'sonnet').classify([file], 'en')).toEqual([])
  })

  it('should key the verdict by the input file name, not a differently-cased echo', async () => {
    const provider = providerReturning(
      '[{"fileName":"Invoice-0000044616.PDF","category":"Documents","subcategory":"Invoices","suggestedName":null,"confidence":0.9}]'
    )
    const verdicts = await new ClaudeSorter(provider, 'sonnet').classify([file], 'en')
    expect(verdicts[0].name).toBe('invoice-0000044616.pdf')
  })

  it('should leave an unresolved category at Other/Other when the model also says Other', async () => {
    const provider = providerReturning(
      '[{"fileName":"invoice-0000044616.pdf","category":"Finance","subcategory":"Other","suggestedName":null,"confidence":0.4}]'
    )
    const verdicts = await new ClaudeSorter(provider, 'sonnet').classify([file], 'en')
    expect(verdicts[0].category).toBe('Other')
    expect(verdicts[0].subcategory).toBe('Other')
  })

  it('should match each file in a batch to its own verdict regardless of reply order', async () => {
    const invoice = file
    const photo = {
      path: '/tmp/beach.jpg',
      name: 'beach.jpg',
      size: 20480,
      extensionHint: 'Images',
      extractedText: '',
      entities: { dates: [], names: [], amounts: [], organizations: [], locations: [] }
    }
    const provider = providerReturning(
      JSON.stringify([
        {
          fileName: 'beach.jpg',
          category: 'Images',
          subcategory: 'Photos',
          suggestedName: null,
          confidence: 0.8
        },
        {
          fileName: 'invoice-0000044616.pdf',
          category: 'Documents',
          subcategory: 'Invoices',
          suggestedName: null,
          confidence: 0.9
        }
      ])
    )
    const verdicts = await new ClaudeSorter(provider, 'sonnet').classify([invoice, photo], 'en')

    const invoiceVerdict = verdicts.find((v) => v.name === 'invoice-0000044616.pdf')
    const photoVerdict = verdicts.find((v) => v.name === 'beach.jpg')
    expect(invoiceVerdict?.category).toBe('Documents')
    expect(invoiceVerdict?.subcategory).toBe('Invoices')
    expect(photoVerdict?.category).toBe('Images')
    expect(photoVerdict?.subcategory).toBe('Photos')
  })

  it('should rehome each of two same-named files by its own answer', async () => {
    const reports: SorterInput[] = [
      { ...file, path: '/tmp/2025/report.pdf', name: 'report.pdf' },
      { ...file, path: '/tmp/2026/report.pdf', name: 'report.pdf' }
    ]
    const provider = providerReplying([
      {
        text: JSON.stringify([
          {
            fileName: 'report.pdf',
            category: 'Finance dept',
            subcategory: 'Invoices',
            suggestedName: null,
            confidence: 0.9
          },
          {
            fileName: 'report.pdf',
            category: 'Documents',
            subcategory: 'Contracts',
            suggestedName: null,
            confidence: 0.9
          }
        ])
      }
    ])

    const verdicts = await new ClaudeSorter(provider, 'sonnet').classify(reports, 'en')

    expect(verdicts.find((v) => v.path === '/tmp/2025/report.pdf')?.subcategory).toBe('Invoices')
    expect(verdicts.find((v) => v.path === '/tmp/2026/report.pdf')?.subcategory).toBe('Contracts')
  })

  describe('a folder larger than one request', () => {
    const many = documents(30)

    it('should ask in more than one request and answer for every file', async () => {
      const provider = providerReplying([
        { text: replyFor(many.slice(0, 25)) },
        { text: replyFor(many.slice(25)) }
      ])

      const verdicts = await new ClaudeSorter(provider, 'sonnet').classify(many, 'en')

      expect(provider.prompts).toHaveLength(2)
      expect(verdicts).toHaveLength(30)
    })

    it('should keep the other requests when one reply hits the output cap', async () => {
      const provider = providerReplying([
        { text: replyFor(many.slice(0, 25)), stopReason: 'max_tokens' },
        { text: replyFor(many.slice(25)) }
      ])

      const verdicts = await new ClaudeSorter(provider, 'sonnet').classify(many, 'en')

      expect(verdicts.map((v) => v.name)).toEqual(many.slice(25).map((f) => f.name))
    })

    it('should report progress once per request instead of going quiet', async () => {
      const provider = providerReplying([{ text: '[]' }, { text: '[]' }])
      const seen: PipelineProgress[] = []

      await new ClaudeSorter(provider, 'sonnet').classify(many, 'en', (p) => seen.push(p))

      expect(seen).toEqual([
        {
          phase: 'classifying-ai',
          completed: 0,
          total: 30,
          currentFile: 'doc-0.pdf, doc-1.pdf, doc-2.pdf'
        },
        {
          phase: 'classifying-ai',
          completed: 25,
          total: 30,
          currentFile: 'doc-25.pdf, doc-26.pdf, doc-27.pdf'
        }
      ])
    })
  })
})
