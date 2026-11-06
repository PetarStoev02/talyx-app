import { describe, expect, it } from 'vitest'
import { markdownImage } from '../../../src/renderer/src/features/chat/markdownImage'

const PIXEL = 'data:image/png;base64,iVBORw0KGgo='

describe('markdownImage', () => {
  describe('given an inline image', () => {
    it('should show a data: image as an image', () => {
      expect(markdownImage(PIXEL, 'pixel')).toEqual({ kind: 'image', src: PIXEL })
    })
  })

  describe('given a remote image', () => {
    it.each([
      ['https://track.example/p.png', 'https://track.example/p.png'],
      ['http://track.example/p.png', 'http://track.example/p.png'],
      ['//track.example/x.png', 'https://track.example/x.png']
    ])('should show %s as a link instead of loading it', (src, href) => {
      expect(markdownImage(src, 'chart')).toEqual({ kind: 'link', href, label: 'chart' })
    })

    it('should label the link with the URL when there is no alt text', () => {
      expect(markdownImage('https://track.example/p.png', '')).toEqual({
        kind: 'link',
        href: 'https://track.example/p.png',
        label: 'https://track.example/p.png'
      })
    })
  })

  describe('given a source that is not a web address', () => {
    it('should show a javascript: URL as plain text, never a link', () => {
      expect(markdownImage('javascript:alert(1)', 'x')).toEqual({ kind: 'text', label: 'x' })
    })

    it('should show the alt text for an empty src', () => {
      expect(markdownImage('', 'missing')).toEqual({ kind: 'text', label: 'missing' })
    })
  })
})
