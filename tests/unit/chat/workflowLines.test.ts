import { describe, expect, it } from 'vitest'
import {
  BRIEF_MARK,
  briefsByRef,
  isProgressReport,
  isQuietReply,
  parseBrief,
  parseStatusLine,
  splitReply,
  summarizeStatus
} from '../../../src/renderer/src/features/chat/workflowLines'

const brief = (lines: string[] = []): string =>
  [
    BRIEF_MARK,
    'Start a Workflows task for acme/api#7: Fix the login',
    'Issue: https://github.com/acme/api/issues/7',
    'Workflow: Ship a feature. You merge the PR.',
    '',
    'Steps, in order:',
    '1. [issue] Issue picked (GitHub issue)',
    '2. [build] Build it (T3 Code thread, bot: t3-tots)',
    '   Open a PR.',
    '',
    'After every check, post exactly one status line for this run in your chat:',
    '[run acme/api#7@mhq2x1c0] step=<step> round=<n>',
    ...lines
  ].join('\n')

describe('workflow lines in a chat', () => {
  describe('a brief', () => {
    it('should read the task, its workflow and its steps', () => {
      expect(parseBrief(brief())).toEqual({
        ref: 'acme/api#7',
        title: 'Fix the login',
        workflow: 'Ship a feature',
        steps: { issue: 'Issue picked', build: 'Build it' }
      })
    })

    it.each([
      ['"Fix the \\"login\\" page"', 'Fix the "login" page'],
      ['"Say hi" to the user', '"Say hi" to the user'],
      ['Fix the login', 'Fix the login']
    ])('should read the title %s as %s', (written, title) => {
      const quoted = brief().replace('Fix the login', written)
      expect(parseBrief(quoted)?.title).toBe(title)
    })

    it('should not take a message without the marker line, even with the task line', () => {
      expect(parseBrief(brief().replace(`${BRIEF_MARK}\n`, ''))).toBeNull()
      expect(parseBrief('Start a Workflows task for acme/api#7: Fix it')).toBeNull()
    })

    it('should not take the marker without the task line after it', () => {
      expect(parseBrief(`${BRIEF_MARK}\nHello`)).toBeNull()
    })

    it('should index every brief in a chat by its task', () => {
      expect(Object.keys(briefsByRef(['hi', brief()]))).toEqual(['acme/api#7'])
    })
  })

  describe('a status line', () => {
    it('should read plain and quoted fields', () => {
      expect(
        parseStatusLine(
          '[run task#mwat3hrn@mwat3hrn] step=done result="Provider B, for its price."'
        )
      ).toEqual({
        run: 'task#mwat3hrn@mwat3hrn',
        ref: 'task#mwat3hrn',
        fields: { step: 'done', result: 'Provider B, for its price.' },
        line: '[run task#mwat3hrn@mwat3hrn] step=done result="Provider B, for its price."'
      })
      expect(
        parseStatusLine('[run acme/api#7@mhq2x1c0] step=build round=2 pr=66 verdict=NO/YES')?.fields
      ).toEqual({ step: 'build', round: '2', pr: '66', verdict: 'NO/YES' })
    })

    it('should read a line in a code span', () => {
      expect(parseStatusLine('`[run acme/api#7@x] step=ready`')?.fields.step).toBe('ready')
    })

    it('should not take the brief’s template, prose after the fields, or a line without a step', () => {
      expect(parseStatusLine('[run acme/api#7@x] step=<step> round=<n>')).toBeNull()
      expect(parseStatusLine('[run acme/api#7@x] step=build and then more')).toBeNull()
      expect(parseStatusLine('[run acme/api#7@x] round=2')).toBeNull()
      expect(parseStatusLine('The run [run acme/api#7@x] step=build')).toBeNull()
    })
  })

  describe('a reply', () => {
    it('should cut out its status lines and keep the text around them', () => {
      expect(splitReply('Checked.\n[run a/b#1@x] step=build\nMore soon.')).toEqual([
        { kind: 'text', text: 'Checked.' },
        {
          kind: 'status',
          status: {
            run: 'a/b#1@x',
            ref: 'a/b#1',
            fields: { step: 'build' },
            line: '[run a/b#1@x] step=build'
          }
        },
        { kind: 'text', text: 'More soon.' }
      ])
    })

    it('should leave a reply without status lines whole', () => {
      expect(splitReply('Just text\n\nmore')).toEqual([{ kind: 'text', text: 'Just text\n\nmore' }])
    })

    it('should leave a status line in a fenced code block as code', () => {
      const text = '```\n[run a/b#1@x] step=build\n```'
      expect(splitReply(text)).toEqual([{ kind: 'text', text }])
    })
  })

  describe('a status line in words', () => {
    const status = (line: string): NonNullable<ReturnType<typeof parseStatusLine>> => {
      const parsed = parseStatusLine(line)
      if (!parsed) throw new Error(`not a status line: ${line}`)
      return parsed
    }
    const known = parseBrief(brief()) ?? undefined

    it('should name the task by its title and the step by its name, with the round', () => {
      expect(summarizeStatus(status('[run acme/api#7@x] step=build round=2'), known)).toEqual({
        task: 'Fix the login',
        step: { name: 'Build it' },
        round: 2,
        detail: null
      })
    })

    it('should fall back to the ref and the step id without a brief, and drop round 1', () => {
      expect(summarizeStatus(status('[run acme/api#9@x] step=build round=1'), undefined)).toEqual({
        task: 'acme/api#9',
        step: { name: 'build' },
        round: null,
        detail: null
      })
    })

    for (const [line, fixed, detail] of [
      ['[run a/b#1@x] step=done result="Shipped"', 'done', 'Shipped'],
      ['[run a/b#1@x] step=needs-you reason="3 rounds"', 'needs-you', '3 rounds'],
      ['[run a/b#1@x] step=ready', 'ready', null],
      ['[run a/b#1@x] step=merged', 'merged', null],
      ['[run a/b#1@x] step=stopped', 'stopped', null]
    ] as const)
      it(`should name the ${fixed} step itself`, () => {
        const summary = summarizeStatus(status(line), undefined)
        expect(summary.step).toEqual({ fixed })
        expect(summary.detail).toBe(detail)
      })
  })
})

describe('which replies the chat leaves to the Workflows page', () => {
  it.each([
    ['a step of the workflow', '[run acme/api#7@m1] step=build round=1', true],
    [
      'a step with the bot’s notes around it',
      'Started the thread.\n[run acme/api#7@m1] step=build round=1\nRan gh pr view.',
      true
    ],
    [
      'two tasks moving along',
      '[run acme/api#7@m1] step=build\n[run acme/api#8@m2] step=checking',
      true
    ],
    ['ready to merge', '[run acme/api#7@m1] step=ready pr=66', false],
    ['a question for you', '[run acme/api#7@m1] step=needs-you reason="which branch?"', false],
    ['merged', 'Merged it.\n[run acme/api#7@m1] step=merged pr=66', false],
    ['done', '[run task#m1@m1] step=done result="B"', false],
    ['stopped', '[run acme/api#7@m1] step=stopped', false],
    [
      'one task moving and one waiting on you',
      '[run acme/api#7@m1] step=build\n[run acme/api#8@m2] step=ready',
      false
    ],
    ['a reply without a status line', 'Here is the plan.', false],
    ['the brief’s template quoted back', '[run acme/api#7@m1] step=<step> round=<n>', false]
  ])('given %s, should hide it: %s', (_why, text, hidden) => {
    expect(isProgressReport(text)).toBe(hidden)
  })
})

describe('which chat items stay out of the chat', () => {
  const PROGRESS = '[run acme/api#7@m1] step=build round=1'
  const reply = (patch: { error?: string | null; stopped?: boolean; streaming?: boolean } = {}) =>
    ({
      kind: 'bot',
      id: '1',
      text: PROGRESS,
      streaming: false,
      error: null,
      stopped: false,
      sender: null,
      ...patch
    }) as const

  it.each([
    ['a finished progress reply', reply(), true],
    ['one still streaming', reply({ streaming: true }), false],
    ['one that failed', reply({ error: 'The provider refused' }), false],
    ['one you stopped', reply({ stopped: true }), false]
  ])('given %s, should leave it out: %s', (_why, item, quiet) => {
    expect(isQuietReply(item)).toBe(quiet)
  })

  it('should keep what you wrote, even a status line', () => {
    expect(isQuietReply({ kind: 'user', id: '2', text: PROGRESS, images: [] })).toBe(false)
  })
})
