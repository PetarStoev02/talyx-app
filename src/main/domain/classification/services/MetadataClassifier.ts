import { readFile } from 'node:fs/promises'

export interface MetadataResult {
  subcategory: string | null
  metadata: Record<string, unknown>
}

export class MetadataClassifier {
  async classify(filePath: string, category: string): Promise<MetadataResult> {
    switch (category) {
      case 'Images':
        return this.classifyImage(filePath)
      case 'Audio':
        return this.classifyAudio(filePath)
      case 'Documents':
        return this.classifyDocument(filePath)
      default:
        return { subcategory: null, metadata: {} }
    }
  }

  private async classifyImage(filePath: string): Promise<MetadataResult> {
    try {
      const exifr = await import('exifr')
      const exifData = await exifr.parse(filePath)

      if (!exifData) {
        return { subcategory: 'Graphics', metadata: {} }
      }

      const metadata: Record<string, unknown> = {}

      if (exifData.DateTimeOriginal) {
        metadata.date = exifData.DateTimeOriginal
      }
      if (exifData.Make || exifData.Model) {
        metadata.camera = [exifData.Make, exifData.Model].filter(Boolean).join(' ')
      }
      if (exifData.ImageWidth) {
        metadata.width = exifData.ImageWidth
      }
      if (exifData.ImageHeight) {
        metadata.height = exifData.ImageHeight
      }
      if (exifData.ExifImageWidth) {
        metadata.width = exifData.ExifImageWidth
      }
      if (exifData.ExifImageHeight) {
        metadata.height = exifData.ExifImageHeight
      }

      const hasPhotoIndicators = exifData.GPSLatitude || exifData.DateTimeOriginal
      const subcategory = hasPhotoIndicators ? 'Photos' : 'Graphics'

      return { subcategory, metadata }
    } catch {
      return { subcategory: 'Graphics', metadata: {} }
    }
  }

  private async classifyAudio(filePath: string): Promise<MetadataResult> {
    try {
      const musicMetadata = await import('music-metadata')
      const parsed = await musicMetadata.parseFile(filePath)

      const metadata: Record<string, unknown> = {}
      const { common, format } = parsed

      if (common.artist) {
        metadata.artist = common.artist
      }
      if (common.album) {
        metadata.album = common.album
      }
      if (common.genre && common.genre.length > 0) {
        metadata.genre = common.genre[0]
      }
      if (format.duration) {
        metadata.duration = format.duration
      }

      const hasMusicTags = common.artist || common.album
      const subcategory = hasMusicTags ? 'Music' : 'Recordings'

      return { subcategory, metadata }
    } catch {
      return { subcategory: 'Recordings', metadata: {} }
    }
  }

  private async classifyDocument(filePath: string): Promise<MetadataResult> {
    try {
      if (!filePath.toLowerCase().endsWith('.pdf')) {
        return { subcategory: null, metadata: {} }
      }

      const buffer = await readFile(filePath)
      const { PDFParse } = await import('pdf-parse')

      const parser = new PDFParse({ data: new Uint8Array(buffer) })
      const pdfInfo = await parser.getInfo()

      const metadata: Record<string, unknown> = {}

      if (pdfInfo.info) {
        if (pdfInfo.info.Author) {
          metadata.author = pdfInfo.info.Author
        }
        if (pdfInfo.info.Title) {
          metadata.title = pdfInfo.info.Title
        }
      }

      if (pdfInfo.total) {
        metadata.pageCount = pdfInfo.total
      }

      await parser.destroy()

      return { subcategory: null, metadata }
    } catch {
      return { subcategory: null, metadata: {} }
    }
  }
}
