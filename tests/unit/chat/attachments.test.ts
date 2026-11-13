import { describe, expect, it } from 'vitest'
import {
  baseName,
  draftWithPaths,
  sortAttachments
} from '../../../src/renderer/src/features/chat/attachments'

function fileOf(name: string, type: string): File {
  return new File(['x'], name, { type })
}

// Where each test file sits on disk; a file missing here has no path, like one dragged from a web page.
function pathsOn(disk: Map<File, string>): (file: File) => string {
  return (file) => disk.get(file) ?? ''
}

describe('sortAttachments', () => {
  it('should attach nothing when no file is given', () => {
    expect(sortAttachments([], pathsOn(new Map()))).toEqual({ images: [], paths: [], refused: [] })
  })

  it('should upload every image and keep their order', () => {
    const png = fileOf('a.png', 'image/png')
    const jpeg = fileOf('b.jpg', 'image/jpeg')
    expect(sortAttachments([png, jpeg], pathsOn(new Map()))).toEqual({
      images: [png, jpeg],
      paths: [],
      refused: []
    })
  })

  it('should pass any other file or folder on this computer by its path', () => {
    const png = fileOf('a.png', 'image/png')
    const pdf = fileOf('report.pdf', 'application/pdf')
    const folder = fileOf('Reports', '')
    const disk = new Map([
      [png, '/Users/me/a.png'],
      [pdf, '/Users/me/Q3 report.pdf'],
      [folder, '/Users/me/Reports']
    ])
    expect(sortAttachments([pdf, png, folder], pathsOn(disk))).toEqual({
      images: [png],
      paths: ['/Users/me/Q3 report.pdf', '/Users/me/Reports'],
      refused: []
    })
  })

  it('should refuse a file that is neither an image nor on this computer', () => {
    const pdf = fileOf('report.pdf', 'application/pdf')
    expect(sortAttachments([pdf], pathsOn(new Map()))).toEqual({
      images: [],
      paths: [],
      refused: [pdf]
    })
  })
})

describe('draftWithPaths', () => {
  it('should leave the draft as it is when there is no path', () => {
    expect(draftWithPaths('Summarise this', [])).toBe('Summarise this')
  })

  it('should put the path alone in an empty draft', () => {
    expect(draftWithPaths('', ['/Users/me/a.pdf'])).toBe('/Users/me/a.pdf')
  })

  it('should add each path on its own line under the typed text', () => {
    expect(draftWithPaths('Compare these', ['/Users/me/a.pdf', '/Users/me/Q3 report.pdf'])).toBe(
      'Compare these\n/Users/me/a.pdf\n/Users/me/Q3 report.pdf'
    )
  })
})

describe('baseName', () => {
  it.each([
    ['/Users/me/Q3 report.pdf', 'Q3 report.pdf'],
    ['/Users/me/Reports/', 'Reports'],
    ['C:\\Users\\me\\notes.md', 'notes.md'],
    ['notes.md', 'notes.md']
  ])('should name %s by its last part', (path, name) => {
    expect(baseName(path)).toBe(name)
  })
})
