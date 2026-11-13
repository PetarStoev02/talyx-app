import { describe, expect, it } from 'vitest'
import { carriesFiles, sortAttachments } from '../../../src/renderer/src/features/chat/attachments'

function fileOf(name: string, type: string): File {
  return new File(['x'], name, { type })
}

describe('sortAttachments', () => {
  it('should attach nothing and refuse nothing when no file is given', () => {
    expect(sortAttachments([])).toEqual({ images: [], refused: [] })
  })

  it('should attach every image and keep their order', () => {
    const png = fileOf('a.png', 'image/png')
    const jpeg = fileOf('b.jpg', 'image/jpeg')
    expect(sortAttachments([png, jpeg])).toEqual({ images: [png, jpeg], refused: [] })
  })

  it('should refuse the files that are not images and still attach the images', () => {
    const png = fileOf('a.png', 'image/png')
    const pdf = fileOf('report.pdf', 'application/pdf')
    const unknown = fileOf('notes', '')
    expect(sortAttachments([pdf, png, unknown])).toEqual({ images: [png], refused: [pdf, unknown] })
  })
})

describe('carriesFiles', () => {
  it('should say a drag carries files only when its types list Files', () => {
    expect(carriesFiles(['Files'])).toBe(true)
    expect(carriesFiles(['text/plain', 'text/uri-list'])).toBe(false)
    expect(carriesFiles([])).toBe(false)
  })
})
