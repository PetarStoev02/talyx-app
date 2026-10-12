import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  TextExtractor,
  readsContent
} from '../../../src/main/domain/classification/services/TextExtractor'
import AdmZip from 'adm-zip'
import * as XLSX from 'xlsx'
import { writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('TextExtractor', () => {
  const testDir = join(tmpdir(), 'talyx-text-extractor-test')
  const extractor = new TextExtractor(500) // low cap for testing

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  it('extracts text from .txt files', async () => {
    const path = join(testDir, 'test.txt')
    writeFileSync(path, 'Hello world, this is a test document.')
    const result = await extractor.extract(path)
    expect(result.text).toBe('Hello world, this is a test document.')
    expect(result.truncated).toBe(false)
  })

  it('extracts text from .csv files', async () => {
    const path = join(testDir, 'test.csv')
    writeFileSync(path, 'name,age\nAlice,30\nBob,25')
    const result = await extractor.extract(path)
    expect(result.text).toContain('Alice')
    expect(result.text).toContain('Bob')
  })

  it('extracts text from .md files', async () => {
    const path = join(testDir, 'test.md')
    writeFileSync(path, '# Title\n\nSome markdown content here.')
    const result = await extractor.extract(path)
    expect(result.text).toContain('Title')
    expect(result.text).toContain('markdown content')
  })

  it('extracts text from .html files', async () => {
    const path = join(testDir, 'test.html')
    writeFileSync(path, '<html><body><h1>Hello</h1><p>World</p></body></html>')
    const result = await extractor.extract(path)
    expect(result.text).toContain('Hello')
    expect(result.text).toContain('World')
  })

  it('strips script and style tags from HTML', async () => {
    const path = join(testDir, 'test.html')
    writeFileSync(
      path,
      '<html><head><style>body{color:red}</style></head><body><script>alert(1)</script><p>Content</p></body></html>'
    )
    const result = await extractor.extract(path)
    expect(result.text).toContain('Content')
    expect(result.text).not.toContain('alert')
    expect(result.text).not.toContain('color')
  })

  it('truncates text exceeding maxChars', async () => {
    const path = join(testDir, 'long.txt')
    writeFileSync(path, 'a'.repeat(1000))
    const result = await extractor.extract(path)
    expect(result.text.length).toBeLessThanOrEqual(500)
    expect(result.truncated).toBe(true)
  })

  it('returns empty text for unsupported file types', async () => {
    const path = join(testDir, 'test.xyz')
    writeFileSync(path, 'some content')
    const result = await extractor.extract(path)
    expect(result.text).toBe('')
  })

  it('returns empty text for files exceeding size limit', async () => {
    const path = join(testDir, 'big.txt')
    const smallExtractor = new TextExtractor(100, 10) // 10 byte size limit
    writeFileSync(path, 'a'.repeat(100))
    const result = await smallExtractor.extract(path)
    expect(result.text).toBe('')
  })

  it('handles non-existent files gracefully', async () => {
    const result = await extractor.extract('/nonexistent/file.txt')
    expect(result.text).toBe('')
  })

  it('extracts text from .log files', async () => {
    const path = join(testDir, 'app.log')
    writeFileSync(path, '2024-01-15 ERROR: Something went wrong')
    const result = await extractor.extract(path)
    expect(result.text).toContain('ERROR')
  })

  it('extracts every sheet from .xlsx files', async () => {
    const path = join(testDir, 'budget.xlsx')
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['item', 'cost'],
        ['rent', 900]
      ]),
      'Costs'
    )
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([['client'], ['Acme']]),
      'Clients'
    )
    writeFileSync(path, XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }))
    const result = await extractor.extract(path)
    expect(result.text).toContain('[Costs]')
    expect(result.text).toContain('rent,900')
    expect(result.text).toContain('[Clients]')
    expect(result.text).toContain('Acme')
    expect(result.readContent).toBe(true)
  })

  it('extracts slide text from zip-based .pptx files', async () => {
    const path = join(testDir, 'deck.pptx')
    const zip = new AdmZip()
    zip.addFile('ppt/slides/slide1.xml', Buffer.from('<p:sld><a:t>Quarterly plan</a:t></p:sld>'))
    zip.addFile('docProps/app.xml', Buffer.from('<a:t>ignored</a:t>'))
    zip.writeZip(path)
    const result = await extractor.extract(path)
    expect(result.text).toContain('Quarterly plan')
    expect(result.text).not.toContain('ignored')
  })

  describe('readContent — whether anything was actually read', () => {
    it('should report reading a text document', async () => {
      const path = join(testDir, 'notes.txt')
      writeFileSync(path, 'Hello world')
      expect((await extractor.extract(path)).readContent).toBe(true)
    })

    it('should not report reading an unsupported file type', async () => {
      const path = join(testDir, 'archive.zip')
      writeFileSync(path, 'binary')
      expect((await extractor.extract(path)).readContent).toBe(false)
    })

    it('should not report reading an image it only took EXIF from', async () => {
      const path = join(testDir, 'photo.jpg')
      writeFileSync(path, 'not really a jpeg')
      const result = await extractor.extract(path)
      expect(result.text.length).toBeGreaterThan(0)
      expect(result.readContent).toBe(false)
    })

    it('should not report reading an SVG with no title, desc or text', async () => {
      const path = join(testDir, 'icon.svg')
      writeFileSync(path, '<svg><path d="M0 0"/></svg>')
      const result = await extractor.extract(path)
      expect(result.text).toBe('SVG vector graphic')
      expect(result.readContent).toBe(false)
    })

    it('should report reading an SVG that carries a title', async () => {
      const path = join(testDir, 'diagram.svg')
      writeFileSync(path, '<svg><title>Architecture</title><path d="M0 0"/></svg>')
      expect((await extractor.extract(path)).readContent).toBe(true)
    })

    it('should not report reading a glTF that parsed but described nothing', async () => {
      const path = join(testDir, 'empty.gltf')
      writeFileSync(path, JSON.stringify({ asset: {} }))
      const result = await extractor.extract(path)
      expect(result.text).toBe('3D model (glTF format)')
      expect(result.readContent).toBe(false)
    })

    it('should report reading a glTF that described its contents', async () => {
      const path = join(testDir, 'model.gltf')
      writeFileSync(path, JSON.stringify({ asset: { generator: 'Blender' }, meshes: [{}] }))
      expect((await extractor.extract(path)).readContent).toBe(true)
    })
  })

  describe('readsContent — would this file need reading', () => {
    it.each(['notes.txt', 'data.csv', 'readme.md', 'log.log', 'a.json', 'b.yaml'])(
      'should say %s needs reading',
      (name) => expect(readsContent(`/tmp/${name}`)).toBe(true)
    )

    it.each(['invoice.pdf', 'letter.docx', 'sheet.xlsx', 'book.ods', 'deck.pptx', 'mail.eml'])(
      'should say %s needs reading',
      (name) => expect(readsContent(`/tmp/${name}`)).toBe(true)
    )

    it.each(['page.html', 'page.htm', 'design.fig', 'model.gltf'])(
      'should say %s needs reading',
      (name) => expect(readsContent(`/tmp/${name}`)).toBe(true)
    )

    it.each(['holiday.jpg', 'shot.png', 'scan.heic', 'clip.mp4', 'clip.mov', 'icon.svg'])(
      'should say %s does not need reading',
      (name) => expect(readsContent(`/tmp/${name}`)).toBe(false)
    )

    it.each(['song.mp3', 'app.dmg', 'backup.zip', 'main.ts', 'noextension'])(
      'should say %s does not need reading',
      (name) => expect(readsContent(`/tmp/${name}`)).toBe(false)
    )

    it('should ignore the case of the extension', () => {
      expect(readsContent('/tmp/INVOICE.PDF')).toBe(true)
    })
  })
})
