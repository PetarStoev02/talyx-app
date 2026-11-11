import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getVersion: () => '1.0.0' }, BrowserWindow: class {} }))
vi.mock('electron-log', () => ({ default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }))

import {
  countChanges,
  parseHighlights
} from '../../../src/main/infrastructure/updater/releaseCheck'

describe('parseHighlights', () => {
  it('should return nothing when the body has no Highlights section', () => {
    expect(parseHighlights("## What's Changed\n- **Not a highlight.** Ignored.")).toEqual([])
  })

  it('should read one bold lead and its text', () => {
    const body = '## Highlights\n- **Update button.** Talyx tells you about new releases.\n'
    expect(parseHighlights(body)).toEqual([
      { lead: 'Update button.', text: 'Talyx tells you about new releases.' }
    ])
  })

  it('should keep at most three highlights', () => {
    const body = [1, 2, 3, 4].map((n) => `- **L${n}.** T${n}.`).join('\n')
    const found = parseHighlights(`## Highlights\n${body}`)
    expect(found.map((h) => h.lead)).toEqual(['L1.', 'L2.', 'L3.'])
  })

  it('should skip lines that are not a bold lead plus text', () => {
    const body = [
      '## Highlights',
      'plain paragraph',
      '- no bold here',
      '- **Only a lead.**',
      '- **Good.** Kept.'
    ].join('\n')
    expect(parseHighlights(body)).toEqual([{ lead: 'Good.', text: 'Kept.' }])
  })

  it('should stop at the next section and read Windows line endings', () => {
    const body = '## Highlights\r\n- **One.** First.\r\n\r\n## Other\r\n- **Two.** Second.\r\n'
    expect(parseHighlights(body)).toEqual([{ lead: 'One.', text: 'First.' }])
  })
})

describe('countChanges', () => {
  it('should be zero without a What is Changed section', () => {
    expect(countChanges('## Highlights\n- **A.** b.')).toBe(0)
  })

  it('should count the bullets under What is Changed only', () => {
    const body = [
      '## Highlights',
      '- **A.** b.',
      "## What's Changed",
      '* fix: one by @a in #1',
      '* feat: two by @b in #2',
      '',
      '**Full Changelog**: https://example.test/compare',
      '## Other',
      '- not counted'
    ].join('\n')
    expect(countChanges(body)).toBe(2)
  })
})
