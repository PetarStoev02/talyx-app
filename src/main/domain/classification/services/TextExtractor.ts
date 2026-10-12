import { readFile, stat } from 'fs/promises'
import { extname } from 'path'

export interface ExtractionResult {
  text: string
  metadata: Record<string, unknown>
  truncated: boolean
  /**
   * True only when an extractor actually read the file's contents. False for
   * the stat and EXIF summaries this class writes for images and videos, and
   * for every placeholder it writes when there was nothing to read: those read
   * like text but say only what the file system already knew, so a caller
   * deciding whether a file is worth sending anywhere must not count them.
   */
  readContent: boolean
}

const EMPTY_RESULT: ExtractionResult = {
  text: '',
  metadata: {},
  truncated: false,
  readContent: false
}

const PLAIN_TEXT_EXTENSIONS = new Set([
  '.txt',
  '.csv',
  '.md',
  '.log',
  '.rtf',
  '.json',
  '.yaml',
  '.yml'
])

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.tiff', '.bmp', '.webp', '.heic'])

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm'])

const SVG_EXTENSIONS = new Set(['.svg'])

/**
 * Every extension `extract` dispatches to a real content reader for, minus the
 * plain-text set below. Keep in step with `extract`'s branches.
 */
const DOCUMENT_EXTENSIONS = new Set([
  '.pdf',
  '.docx',
  '.xlsx',
  '.xls',
  '.ods',
  '.pptx',
  '.eml',
  '.html',
  '.htm',
  '.fig',
  '.gltf'
])

const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

/**
 * Would this file need reading? Answered from its name alone — no IO, no
 * `stat` — so a path that reads nothing can still say how many files another
 * sorter would have to open.
 *
 * Not the same question as `ExtractionResult.readContent`, which says whether
 * a reader actually came back with something and is what gates sending a file
 * anywhere. This one is deliberately the looser of the two: a PDF of scanned
 * images answers `true` here and `false` there.
 */
export function readsContent(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase()
  return PLAIN_TEXT_EXTENSIONS.has(ext) || DOCUMENT_EXTENSIONS.has(ext)
}

export class TextExtractor {
  constructor(
    private maxChars: number = 8000,
    private maxFileSize: number = DEFAULT_MAX_FILE_SIZE
  ) {}

  async extract(filePath: string): Promise<ExtractionResult> {
    try {
      const fileStats = await stat(filePath)
      if (fileStats.size > this.maxFileSize) {
        return EMPTY_RESULT
      }

      const ext = extname(filePath).toLowerCase()
      let result: ExtractionResult

      if (PLAIN_TEXT_EXTENSIONS.has(ext)) {
        result = await this.extractPlainText(filePath)
      } else if (ext === '.pdf') {
        result = await this.extractPdf(filePath)
      } else if (ext === '.docx') {
        result = await this.extractDocx(filePath)
      } else if (ext === '.xlsx' || ext === '.xls' || ext === '.ods') {
        result = await this.extractXlsx(filePath)
      } else if (ext === '.pptx') {
        result = await this.extractPptx(filePath)
      } else if (ext === '.eml') {
        result = await this.extractEml(filePath)
      } else if (ext === '.html' || ext === '.htm') {
        result = await this.extractHtml(filePath)
      } else if (ext === '.fig') {
        result = await this.extractFigma(filePath)
      } else if (IMAGE_EXTENSIONS.has(ext)) {
        result = await this.extractImageMetadata(filePath)
      } else if (SVG_EXTENSIONS.has(ext)) {
        result = await this.extractSvg(filePath)
      } else if (VIDEO_EXTENSIONS.has(ext)) {
        result = await this.extractVideoMetadata(filePath)
      } else if (ext === '.gltf') {
        result = await this.extractGltf(filePath)
      } else {
        return EMPTY_RESULT
      }

      return this.truncate(result)
    } catch {
      return EMPTY_RESULT
    }
  }

  private async extractPlainText(filePath: string): Promise<ExtractionResult> {
    try {
      const text = await readFile(filePath, 'utf-8')
      return { text, metadata: {}, truncated: false, readContent: true }
    } catch {
      try {
        const text = await readFile(filePath, 'latin1')
        return { text, metadata: {}, truncated: false, readContent: true }
      } catch {
        return EMPTY_RESULT
      }
    }
  }

  private async extractPdf(filePath: string): Promise<ExtractionResult> {
    // pdf-parse v2 uses a class-based API: new PDFParse({ data }) → .getText()
    const { PDFParse } = await import('pdf-parse')
    const buffer = await readFile(filePath)
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    const result = await parser.getText()
    await parser.destroy().catch(() => {})
    return {
      text: result.text,
      metadata: {
        pages: result.total
      },
      truncated: false,
      readContent: true
    }
  }

  private async extractDocx(filePath: string): Promise<ExtractionResult> {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ path: filePath })
    return { text: result.value, metadata: {}, truncated: false, readContent: true }
  }

  private async extractXlsx(filePath: string): Promise<ExtractionResult> {
    const XLSX = await import('xlsx')
    // XLSX.read on a buffer: the ESM build of xlsx 0.20 has no fs until set_fs() is called
    const workbook = XLSX.read(await readFile(filePath))
    const texts: string[] = []
    for (const sheetName of workbook.SheetNames) {
      texts.push(`[${sheetName}]`)
      const sheet = workbook.Sheets[sheetName]
      const csv = XLSX.utils.sheet_to_csv(sheet)
      texts.push(csv)
    }
    return {
      text: texts.join('\n'),
      metadata: { sheets: workbook.SheetNames },
      truncated: false,
      readContent: true
    }
  }

  private async extractPptx(filePath: string): Promise<ExtractionResult> {
    const AdmZip = (await import('adm-zip')).default
    const buffer = await readFile(filePath)
    const zip = new AdmZip(buffer)
    const texts: string[] = []

    for (const entry of zip.getEntries()) {
      if (entry.entryName.match(/ppt\/slides\/slide\d+\.xml/)) {
        const xml = entry.getData().toString('utf-8')
        const text = xml
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        texts.push(text)
      }
    }
    return { text: texts.join('\n'), metadata: {}, truncated: false, readContent: true }
  }

  private async extractEml(filePath: string): Promise<ExtractionResult> {
    const { simpleParser } = await import('mailparser')
    const source = await readFile(filePath)
    const parsed = await simpleParser(source)
    const parts = [
      parsed.subject ? `Subject: ${parsed.subject}` : '',
      parsed.from?.text ? `From: ${parsed.from.text}` : '',
      parsed.text || ''
    ].filter(Boolean)
    return {
      text: parts.join('\n'),
      metadata: {
        subject: parsed.subject,
        from: parsed.from?.text,
        date: parsed.date?.toISOString()
      },
      truncated: false,
      readContent: true
    }
  }

  private async extractHtml(filePath: string): Promise<ExtractionResult> {
    const cheerio = await import('cheerio')
    const html = await readFile(filePath, 'utf-8')
    const $ = cheerio.load(html)
    $('script, style').remove()
    const text = $('body').text().replace(/\s+/g, ' ').trim()
    const title = $('title').text()
    return {
      text,
      metadata: { title: title || undefined },
      truncated: false,
      readContent: true
    }
  }

  private async extractImageMetadata(filePath: string): Promise<ExtractionResult> {
    // EXIF only: it takes ~5ms an image, where reading the pixels would take seconds
    const exifr = await import('exifr')
    const buffer = await readFile(filePath)
    const exif = await exifr
      .parse(buffer, {
        tiff: true,
        xmp: true,
        iptc: true,
        gps: true,
        icc: false
      })
      .catch(() => null)

    const parts: string[] = []
    if (exif) {
      if (exif.ImageDescription) parts.push(`Description: ${exif.ImageDescription}`)
      if (exif.Title || exif['dc:title']) parts.push(`Title: ${exif.Title || exif['dc:title']}`)
      if (exif.Subject || exif['dc:subject']) {
        const subj = exif.Subject || exif['dc:subject']
        parts.push(`Subject: ${Array.isArray(subj) ? subj.join(', ') : subj}`)
      }
      if (exif.Make && exif.Model) parts.push(`Camera: ${exif.Make} ${exif.Model}`)
      if (exif.DateTimeOriginal) parts.push(`Date taken: ${exif.DateTimeOriginal}`)
      if (exif.ImageWidth && exif.ImageHeight) {
        parts.push(`Dimensions: ${exif.ImageWidth}x${exif.ImageHeight}`)
      }
      if (exif.latitude && exif.longitude) {
        parts.push(`GPS: ${exif.latitude.toFixed(4)}, ${exif.longitude.toFixed(4)}`)
      }
      if (exif.Software) parts.push(`Software: ${exif.Software}`)
      if (exif.Artist || exif['dc:creator']) {
        parts.push(`Author: ${exif.Artist || exif['dc:creator']}`)
      }
      // IPTC keywords/caption
      if (exif.Caption) parts.push(`Caption: ${exif.Caption}`)
      if (exif.Keywords) {
        const kw = Array.isArray(exif.Keywords) ? exif.Keywords.join(', ') : exif.Keywords
        parts.push(`Keywords: ${kw}`)
      }
    }

    // If no EXIF data, provide file stats and note the image needs visual inspection
    if (parts.length === 0) {
      const fileStats = await stat(filePath)
      parts.push(`Image file, size: ${(fileStats.size / 1024).toFixed(0)}KB`)
      parts.push(`Created: ${fileStats.birthtime.toISOString().split('T')[0]}`)
      parts.push(
        'Note: No EXIF metadata — classify based on extension and suggest a descriptive name based on the image category'
      )
    }

    // EXIF and file stats, never the picture: nothing here was read out of the
    // image, so this must not send one anywhere.
    return {
      text: parts.join('\n'),
      metadata: exif ? { hasExif: true } : {},
      truncated: false,
      readContent: false
    }
  }

  private async extractSvg(filePath: string): Promise<ExtractionResult> {
    const svg = await readFile(filePath, 'utf-8')
    // Extract text content and meaningful attributes from SVG XML
    const textContent = svg
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    // Also grab title and desc elements
    const titleMatch = svg.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    const descMatch = svg.match(/<desc[^>]*>([\s\S]*?)<\/desc>/i)
    const parts: string[] = []
    if (titleMatch) parts.push(`Title: ${titleMatch[1].trim()}`)
    if (descMatch) parts.push(`Description: ${descMatch[1].trim()}`)
    if (textContent) parts.push(textContent)

    return {
      text: parts.join('\n') || 'SVG vector graphic',
      metadata: {},
      truncated: false,
      // The placeholder says only that the file is an SVG.
      readContent: parts.length > 0
    }
  }

  private async extractVideoMetadata(filePath: string): Promise<ExtractionResult> {
    const fileStats = await stat(filePath)
    const ext = extname(filePath).toLowerCase()
    const sizeMB = (fileStats.size / (1024 * 1024)).toFixed(1)

    const parts: string[] = [
      `Video file (${ext}), size: ${sizeMB}MB`,
      `Created: ${fileStats.birthtime.toISOString().split('T')[0]}`,
      `Modified: ${fileStats.mtime.toISOString().split('T')[0]}`
    ]

    // Size and dates — the video itself was not read.
    return {
      text: parts.join('\n'),
      metadata: { sizeMB: parseFloat(sizeMB) },
      truncated: false,
      readContent: false
    }
  }

  private async extractGltf(filePath: string): Promise<ExtractionResult> {
    try {
      const content = await readFile(filePath, 'utf-8')
      const gltf = JSON.parse(content)
      const parts: string[] = ['3D model (glTF format)']
      if (gltf.asset?.generator) parts.push(`Generator: ${gltf.asset.generator}`)
      if (gltf.asset?.copyright) parts.push(`Copyright: ${gltf.asset.copyright}`)
      if (gltf.scenes?.length) parts.push(`Scenes: ${gltf.scenes.length}`)
      if (gltf.meshes?.length) parts.push(`Meshes: ${gltf.meshes.length}`)
      if (gltf.materials?.length) parts.push(`Materials: ${gltf.materials.length}`)
      if (gltf.textures?.length) parts.push(`Textures: ${gltf.textures.length}`)
      // `parts` is seeded with the format label, so one entry means the file
      // parsed but said nothing — the SVG placeholder case again.
      return {
        text: parts.join('\n'),
        metadata: {},
        truncated: false,
        readContent: parts.length > 1
      }
    } catch {
      // Unparseable: the label is all there is, same as the SVG placeholder.
      return { text: '3D model (glTF format)', metadata: {}, truncated: false, readContent: false }
    }
  }

  private async extractFigma(filePath: string): Promise<ExtractionResult> {
    try {
      const AdmZip = (await import('adm-zip')).default
      const buffer = await readFile(filePath)
      const zip = new AdmZip(buffer)
      const parts: string[] = ['Figma design file']

      // Figma files contain a meta.json with document info
      for (const entry of zip.getEntries()) {
        if (entry.entryName === 'meta.json' || entry.entryName === 'canvas.json') {
          try {
            const json = JSON.parse(entry.getData().toString('utf-8'))
            if (json.name) parts.push(`Document name: ${json.name}`)
            if (json.lastModified) parts.push(`Last modified: ${json.lastModified}`)
            if (json.pages) {
              const pageNames = Array.isArray(json.pages)
                ? json.pages.map((p: { name?: string }) => p.name).filter(Boolean)
                : Object.values(json.pages)
                    .map((p: unknown) => (p as { name?: string }).name)
                    .filter(Boolean)
              if (pageNames.length > 0) parts.push(`Pages: ${pageNames.join(', ')}`)
            }
          } catch {
            // JSON parse failed — skip
          }
        }
      }

      // List all entry names for hints about content
      const entryNames = zip
        .getEntries()
        .map((e) => e.entryName)
        .filter((n) => !n.startsWith('.'))
      if (entryNames.length > 0) {
        parts.push(`Archive contents: ${entryNames.slice(0, 10).join(', ')}`)
      }

      return { text: parts.join('\n'), metadata: {}, truncated: false, readContent: true }
    } catch {
      return { text: 'Figma design file', metadata: {}, truncated: false, readContent: false }
    }
  }

  private truncate(result: ExtractionResult): ExtractionResult {
    if (result.text.length > this.maxChars) {
      return {
        ...result,
        text: result.text.slice(0, this.maxChars),
        truncated: true
      }
    }
    return result
  }
}
