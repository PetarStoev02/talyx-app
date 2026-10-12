import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('exifr', () => ({
  parse: vi.fn()
}))

vi.mock('music-metadata', () => ({
  parseFile: vi.fn()
}))

const mockPdfGetInfo = vi.fn()
const mockPdfDestroy = vi.fn()

vi.mock('pdf-parse', () => ({
  PDFParse: class MockPDFParse {
    getInfo = mockPdfGetInfo
    destroy = mockPdfDestroy
  }
}))

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn()
}))

import { MetadataClassifier } from '../../../src/main/domain/classification/services/MetadataClassifier'

describe('MetadataClassifier', () => {
  let classifier: MetadataClassifier

  beforeEach(() => {
    vi.clearAllMocks()
    classifier = new MetadataClassifier()
  })

  describe('classifyImage', () => {
    it('should return subcategory "Photos" when EXIF has DateTimeOriginal', async () => {
      const exifr = await import('exifr')
      vi.mocked(exifr.parse).mockResolvedValue({
        DateTimeOriginal: new Date('2024-01-15T10:30:00'),
        Make: 'Canon',
        Model: 'EOS R5',
        ExifImageWidth: 4000,
        ExifImageHeight: 3000
      })

      const result = await classifier.classify('/photos/vacation.jpg', 'Images')

      expect(result.subcategory).toBe('Photos')
      expect(result.metadata.date).toEqual(new Date('2024-01-15T10:30:00'))
      expect(result.metadata.camera).toBe('Canon EOS R5')
      expect(result.metadata.width).toBe(4000)
      expect(result.metadata.height).toBe(3000)
    })

    it('should return subcategory "Photos" when EXIF has GPS data', async () => {
      const exifr = await import('exifr')
      vi.mocked(exifr.parse).mockResolvedValue({
        GPSLatitude: 48.8566,
        GPSLongitude: 2.3522
      })

      const result = await classifier.classify('/photos/geotagged.jpg', 'Images')

      expect(result.subcategory).toBe('Photos')
    })

    it('should return subcategory "Graphics" when no EXIF data', async () => {
      const exifr = await import('exifr')
      vi.mocked(exifr.parse).mockResolvedValue(null)

      const result = await classifier.classify('/images/icon.png', 'Images')

      expect(result.subcategory).toBe('Graphics')
      expect(result.metadata).toEqual({})
    })

    it('should return subcategory "Graphics" when EXIF has no photo indicators', async () => {
      const exifr = await import('exifr')
      vi.mocked(exifr.parse).mockResolvedValue({
        ImageWidth: 800,
        ImageHeight: 600
      })

      const result = await classifier.classify('/images/graphic.png', 'Images')

      expect(result.subcategory).toBe('Graphics')
      expect(result.metadata.width).toBe(800)
      expect(result.metadata.height).toBe(600)
    })

    it('should handle errors gracefully and return "Graphics"', async () => {
      const exifr = await import('exifr')
      vi.mocked(exifr.parse).mockRejectedValue(new Error('File not found'))

      const result = await classifier.classify('/nonexistent/file.jpg', 'Images')

      expect(result.subcategory).toBe('Graphics')
      expect(result.metadata).toEqual({})
    })
  })

  describe('classifyAudio', () => {
    it('should return subcategory "Music" when audio has artist and album tags', async () => {
      const musicMetadata = await import('music-metadata')
      vi.mocked(musicMetadata.parseFile).mockResolvedValue({
        common: {
          artist: 'The Beatles',
          album: 'Abbey Road',
          genre: ['Rock']
        },
        format: {
          duration: 259.5
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      const result = await classifier.classify('/music/song.mp3', 'Audio')

      expect(result.subcategory).toBe('Music')
      expect(result.metadata.artist).toBe('The Beatles')
      expect(result.metadata.album).toBe('Abbey Road')
      expect(result.metadata.genre).toBe('Rock')
      expect(result.metadata.duration).toBe(259.5)
    })

    it('should return subcategory "Music" when audio has only artist tag', async () => {
      const musicMetadata = await import('music-metadata')
      vi.mocked(musicMetadata.parseFile).mockResolvedValue({
        common: {
          artist: 'Unknown Artist'
        },
        format: {}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      const result = await classifier.classify('/music/track.mp3', 'Audio')

      expect(result.subcategory).toBe('Music')
      expect(result.metadata.artist).toBe('Unknown Artist')
    })

    it('should return subcategory "Recordings" when no ID3 tags present', async () => {
      const musicMetadata = await import('music-metadata')
      vi.mocked(musicMetadata.parseFile).mockResolvedValue({
        common: {},
        format: {
          duration: 120.0
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)

      const result = await classifier.classify('/recordings/voice_memo.wav', 'Audio')

      expect(result.subcategory).toBe('Recordings')
      expect(result.metadata.duration).toBe(120.0)
      expect(result.metadata.artist).toBeUndefined()
      expect(result.metadata.album).toBeUndefined()
    })

    it('should handle errors gracefully and return "Recordings"', async () => {
      const musicMetadata = await import('music-metadata')
      vi.mocked(musicMetadata.parseFile).mockRejectedValue(new Error('File not found'))

      const result = await classifier.classify('/nonexistent/file.mp3', 'Audio')

      expect(result.subcategory).toBe('Recordings')
      expect(result.metadata).toEqual({})
    })
  })

  describe('classifyDocument', () => {
    it('should extract PDF metadata with author and title', async () => {
      const fsPromises = await import('node:fs/promises')

      vi.mocked(fsPromises.readFile).mockResolvedValue(Buffer.from('fake-pdf-data'))

      mockPdfGetInfo.mockResolvedValue({
        info: {
          Author: 'John Doe',
          Title: 'Annual Report'
        },
        total: 42
      })
      mockPdfDestroy.mockResolvedValue(undefined)

      const result = await classifier.classify('/docs/report.pdf', 'Documents')

      expect(result.subcategory).toBeNull()
      expect(result.metadata.author).toBe('John Doe')
      expect(result.metadata.title).toBe('Annual Report')
      expect(result.metadata.pageCount).toBe(42)
      expect(mockPdfDestroy).toHaveBeenCalled()
    })

    it('should return empty metadata for non-PDF documents', async () => {
      const result = await classifier.classify('/docs/letter.docx', 'Documents')

      expect(result.subcategory).toBeNull()
      expect(result.metadata).toEqual({})
    })

    it('should handle PDF parsing errors gracefully', async () => {
      const fsPromises = await import('node:fs/promises')
      vi.mocked(fsPromises.readFile).mockRejectedValue(new Error('File not found'))

      const result = await classifier.classify('/nonexistent/file.pdf', 'Documents')

      expect(result.subcategory).toBeNull()
      expect(result.metadata).toEqual({})
    })
  })

  describe('unknown category', () => {
    it('should return null subcategory and empty metadata for unknown categories', async () => {
      const result = await classifier.classify('/some/file.xyz', 'Archives')

      expect(result.subcategory).toBeNull()
      expect(result.metadata).toEqual({})
    })

    it('should return null subcategory and empty metadata for Videos category', async () => {
      const result = await classifier.classify('/videos/movie.mp4', 'Videos')

      expect(result.subcategory).toBeNull()
      expect(result.metadata).toEqual({})
    })
  })
})
