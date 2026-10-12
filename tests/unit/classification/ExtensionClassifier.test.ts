import { describe, it, expect } from 'vitest'
import { ExtensionClassifier } from '../../../src/main/domain/classification/services/ExtensionClassifier'

describe('ExtensionClassifier', () => {
  const classifier = new ExtensionClassifier()

  describe('classifies image files', () => {
    it('should classify jpg as Images/Photos', () => {
      const result = classifier.classify('photo.jpg')
      expect(result.category).toBe('Images')
      expect(result.subcategory).toBe('Photos')
      expect(result.confidence).toBe(1.0)
    })

    it('should classify png as Images/Graphics', () => {
      const result = classifier.classify('screenshot.png')
      expect(result.category).toBe('Images')
      expect(result.subcategory).toBe('Graphics')
      expect(result.confidence).toBe(1.0)
    })

    it('should classify svg as Images/Graphics', () => {
      const result = classifier.classify('icon.svg')
      expect(result.category).toBe('Images')
      expect(result.subcategory).toBe('Graphics')
      expect(result.confidence).toBe(1.0)
    })

    it('should classify heic as Images/Photos', () => {
      const result = classifier.classify('IMG_0001.heic')
      expect(result.category).toBe('Images')
      expect(result.subcategory).toBe('Photos')
      expect(result.confidence).toBe(1.0)
    })
  })

  describe('classifies document files', () => {
    it('should classify pdf as Documents', () => {
      const result = classifier.classify('report.pdf')
      expect(result.category).toBe('Documents')
      expect(result.subcategory).toBeNull()
      expect(result.confidence).toBe(1.0)
    })

    it('should classify docx as Documents', () => {
      const result = classifier.classify('letter.docx')
      expect(result.category).toBe('Documents')
      expect(result.subcategory).toBeNull()
      expect(result.confidence).toBe(1.0)
    })

    it('should classify xlsx as Documents/Spreadsheets', () => {
      const result = classifier.classify('budget.xlsx')
      expect(result.category).toBe('Documents')
      expect(result.subcategory).toBe('Spreadsheets')
      expect(result.confidence).toBe(1.0)
    })
  })

  describe('classifies video files', () => {
    it('should classify mp4 as Videos/Movies', () => {
      const result = classifier.classify('movie.mp4')
      expect(result.category).toBe('Videos')
      expect(result.subcategory).toBe('Movies')
      expect(result.confidence).toBe(1.0)
    })

    it('should classify mkv as Videos/Movies', () => {
      const result = classifier.classify('episode.mkv')
      expect(result.category).toBe('Videos')
      expect(result.subcategory).toBe('Movies')
      expect(result.confidence).toBe(1.0)
    })
  })

  describe('classifies audio files', () => {
    it('should classify mp3 as Audio/Music', () => {
      const result = classifier.classify('song.mp3')
      expect(result.category).toBe('Audio')
      expect(result.subcategory).toBe('Music')
      expect(result.confidence).toBe(1.0)
    })

    it('should classify wav as Audio/Recordings', () => {
      const result = classifier.classify('recording.wav')
      expect(result.category).toBe('Audio')
      expect(result.subcategory).toBe('Recordings')
      expect(result.confidence).toBe(1.0)
    })

    it('should classify flac as Audio/Music', () => {
      const result = classifier.classify('album.flac')
      expect(result.category).toBe('Audio')
      expect(result.subcategory).toBe('Music')
      expect(result.confidence).toBe(1.0)
    })
  })

  describe('classifies code files', () => {
    it.each(['index.php', 'app.rb'])('should classify %s as Code', (name) => {
      expect(classifier.classify(name).category).toBe('Code')
    })

    it('should classify ts as Code', () => {
      const result = classifier.classify('index.ts')
      expect(result.category).toBe('Code')
      expect(result.confidence).toBe(1.0)
    })

    it('should classify py as Code', () => {
      const result = classifier.classify('script.py')
      expect(result.category).toBe('Code')
      expect(result.confidence).toBe(1.0)
    })

    it('should classify html as Code', () => {
      const result = classifier.classify('page.html')
      expect(result.category).toBe('Code')
      expect(result.confidence).toBe(1.0)
    })
  })

  describe('classifies archive files', () => {
    it('should classify zip as Archives', () => {
      const result = classifier.classify('backup.zip')
      expect(result.category).toBe('Archives')
      expect(result.confidence).toBe(1.0)
    })

    it('should classify tar as Archives', () => {
      const result = classifier.classify('package.tar')
      expect(result.category).toBe('Archives')
      expect(result.confidence).toBe(1.0)
    })

    it('should classify 7z as Archives', () => {
      const result = classifier.classify('data.7z')
      expect(result.category).toBe('Archives')
      expect(result.confidence).toBe(1.0)
    })
  })

  describe('classifies unknown extensions as Other', () => {
    it('should classify unknown extension as Other with 0.5 confidence', () => {
      const result = classifier.classify('file.xyz')
      expect(result.category).toBe('Other')
      expect(result.subcategory).toBeNull()
      expect(result.confidence).toBe(0.5)
    })

    it('should include extension in metadata for unknown extensions', () => {
      const result = classifier.classify('file.abc')
      expect(result.metadata).toEqual({ extension: 'abc' })
    })
  })

  describe('is case-insensitive', () => {
    it('should classify .JPG the same as .jpg', () => {
      const result = classifier.classify('photo.JPG')
      expect(result.category).toBe('Images')
      expect(result.subcategory).toBe('Photos')
      expect(result.confidence).toBe(1.0)
    })

    it('should classify .Png the same as .png', () => {
      const result = classifier.classify('image.Png')
      expect(result.category).toBe('Images')
      expect(result.subcategory).toBe('Graphics')
      expect(result.confidence).toBe(1.0)
    })

    it('should classify .PDF the same as .pdf', () => {
      const result = classifier.classify('doc.PDF')
      expect(result.category).toBe('Documents')
      expect(result.confidence).toBe(1.0)
    })
  })

  describe('handles files with no extension', () => {
    it('should classify files without extension as Other', () => {
      const result = classifier.classify('Makefile')
      expect(result.category).toBe('Other')
      expect(result.subcategory).toBeNull()
      expect(result.confidence).toBe(0.5)
    })

    it('should classify files ending with a dot as Other', () => {
      const result = classifier.classify('file.')
      expect(result.category).toBe('Other')
      expect(result.subcategory).toBeNull()
      expect(result.confidence).toBe(0.5)
    })
  })
})
