import { describe, it, expect } from 'vitest'
import {
  issueUrl,
  MAX_BODY_CHARS,
  TALYX_NEW_ISSUE_URL
} from '../../../src/renderer/src/features/feedback/githubIssue'

function parse(url: string): URL {
  return new URL(url)
}

describe('issueUrl', () => {
  const base = { appVersion: '0.11.0', systemVersion: '15.1' }

  it('should open a new issue on the public repo', () => {
    const url = parse(issueUrl({ ...base, type: 'bug', message: 'Sort crashes' }))
    expect(`${url.origin}${url.pathname}`).toBe(TALYX_NEW_ISSUE_URL)
  })

  it.each([
    ['bug', '[Bug] Sort crashes'],
    ['idea', '[Idea] Sort crashes'],
    ['other', '[Feedback] Sort crashes']
  ] as const)('should title a %s as "%s"', (type, title) => {
    const url = parse(issueUrl({ ...base, type, message: 'Sort crashes' }))
    expect(url.searchParams.get('title')).toBe(title)
  })

  it('should title the issue with only the first line, cut to 60 characters', () => {
    const first = 'x'.repeat(80)
    const url = parse(issueUrl({ ...base, type: 'bug', message: `${first}\nsecond line` }))
    expect(url.searchParams.get('title')).toBe(`[Bug] ${'x'.repeat(60)}`)
  })

  it('should cut the title at a Windows line break too', () => {
    const url = parse(issueUrl({ ...base, type: 'bug', message: 'line one\r\nline two' }))
    expect(url.searchParams.get('title')).toBe('[Bug] line one')
  })

  it('should keep the whole message in the body and add the versions', () => {
    const url = parse(issueUrl({ ...base, type: 'bug', message: '  line one\nline two  ' }))
    expect(url.searchParams.get('body')).toBe(
      'line one\nline two\n\n---\nTalyx 0.11.0 · macOS 15.1'
    )
  })

  it('should cut a message longer than the limit and tell the user to paste the rest', () => {
    const message = 'a'.repeat(1500)
    const body = parse(issueUrl({ ...base, type: 'bug', message })).searchParams.get('body') ?? ''
    expect(body.startsWith('a'.repeat(MAX_BODY_CHARS) + '\n\n(cut')).toBe(true)
    expect(body).toContain('(cut — paste the rest here)')
    expect(body).not.toContain('a'.repeat(MAX_BODY_CHARS + 1))
  })

  it('should keep a full-length Cyrillic message under the 8000 character URL limit', () => {
    const url = issueUrl({ ...base, type: 'bug', message: 'ж'.repeat(MAX_BODY_CHARS) })
    expect(url.length).toBeLessThan(8000)
  })
})
