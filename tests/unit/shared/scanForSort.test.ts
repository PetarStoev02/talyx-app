import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { scanForSort, detectFolderKind } from '../../../src/main/domain/shared/scanForSort'

describe('scanForSort', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'talyx-scan-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('should not offer a symlink to a file outside the folder for sorting', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'scan-outside-'))
    writeFileSync(join(outside, 'credentials'), 'secret')
    writeFileSync(join(dir, 'a.txt'), 'a')
    symlinkSync(join(outside, 'credentials'), join(dir, 'credentials'))

    const result = await scanForSort(dir)

    expect(result.files.map((f) => f.name)).toEqual(['a.txt'])
    rmSync(outside, { recursive: true, force: true })
  })

  it('should return loose files at the root only', async () => {
    writeFileSync(join(dir, 'invoice.pdf'), 'x')
    writeFileSync(join(dir, 'photo.jpg'), 'x')
    mkdirSync(join(dir, 'my-project'))
    writeFileSync(join(dir, 'my-project', 'index.html'), 'x')

    const result = await scanForSort(dir)
    const names = result.files.map((f) => f.name).sort()
    expect(names).toEqual(['invoice.pdf', 'photo.jpg'])
  })

  it('should never include files from inside subfolders', async () => {
    mkdirSync(join(dir, 'website'))
    writeFileSync(join(dir, 'website', 'style.css'), 'x')
    writeFileSync(join(dir, 'website', 'app.js'), 'x')

    const result = await scanForSort(dir)
    expect(result.files).toHaveLength(0)
  })

  it('should report subfolders as sealed with a detected kind', async () => {
    mkdirSync(join(dir, 'my-app'))
    writeFileSync(join(dir, 'my-app', 'package.json'), '{}')
    mkdirSync(join(dir, 'random-stuff'))
    writeFileSync(join(dir, 'random-stuff', 'note.txt'), 'x')

    const result = await scanForSort(dir)
    const byName = Object.fromEntries(result.sealedFolders.map((s) => [s.name, s]))
    expect(byName['my-app'].kind).toBe('project')
    expect(byName['random-stuff'].kind).toBe('folder')
  })

  it('should skip hidden and temp files', async () => {
    writeFileSync(join(dir, '.DS_Store'), 'x')
    writeFileSync(join(dir, '~$doc.docx'), 'x')
    writeFileSync(join(dir, 'real.txt'), 'x')

    const result = await scanForSort(dir)
    expect(result.files.map((f) => f.name)).toEqual(['real.txt'])
  })

  it('should not report hidden folders as sealed', async () => {
    mkdirSync(join(dir, '.cache'))
    const result = await scanForSort(dir)
    expect(result.sealedFolders).toHaveLength(0)
  })
})

describe('detectFolderKind', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'talyx-kind-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('should detect a project by marker file', async () => {
    writeFileSync(join(dir, 'package.json'), '{}')
    expect(await detectFolderKind(dir)).toBe('project')
  })

  it('should detect a project by .git folder', async () => {
    mkdirSync(join(dir, '.git'))
    expect(await detectFolderKind(dir)).toBe('project')
  })

  it('should detect a website project by index.html with asset folders', async () => {
    writeFileSync(join(dir, 'index.html'), 'x')
    mkdirSync(join(dir, 'css'))
    expect(await detectFolderKind(dir)).toBe('project')
  })

  it('should detect an app folder by executable with libraries', async () => {
    writeFileSync(join(dir, 'setup.exe'), 'x')
    writeFileSync(join(dir, 'core.dll'), 'x')
    expect(await detectFolderKind(dir)).toBe('app')
  })

  it('should detect a code-heavy folder as project', async () => {
    for (const f of ['a.ts', 'b.ts', 'c.tsx', 'd.css', 'e.js']) {
      writeFileSync(join(dir, f), 'x')
    }
    expect(await detectFolderKind(dir)).toBe('project')
  })

  it('should call a folder of documents a plain folder', async () => {
    writeFileSync(join(dir, 'report.pdf'), 'x')
    writeFileSync(join(dir, 'notes.txt'), 'x')
    expect(await detectFolderKind(dir)).toBe('folder')
  })
})

describe('scanForSort going deeper', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'talyx-deep-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  function plainFolderWithFile(name: string, file: string): void {
    mkdirSync(join(dir, name))
    writeFileSync(join(dir, name, file), 'x')
  }

  it('should count files inside plain folders without returning them', async () => {
    writeFileSync(join(dir, 'loose.pdf'), 'x')
    plainFolderWithFile('Holiday', 'beach.jpg')

    const result = await scanForSort(dir)

    expect(result.files.map((f) => f.name)).toEqual(['loose.pdf'])
    expect(result.nestedFileCount).toBe(1)
  })

  it('should return files from plain folders when asked to look inside', async () => {
    writeFileSync(join(dir, 'loose.pdf'), 'x')
    plainFolderWithFile('Holiday', 'beach.jpg')

    const result = await scanForSort(dir, { includeSubfolders: true })

    expect(result.files.map((f) => f.name).sort()).toEqual(['beach.jpg', 'loose.pdf'])
    expect(result.nestedFileCount).toBe(0)
  })

  it('should reach files at any depth under a plain folder', async () => {
    mkdirSync(join(dir, 'Holiday', '2024', 'Crete'), { recursive: true })
    writeFileSync(join(dir, 'Holiday', '2024', 'Crete', 'sunset.jpg'), 'x')

    const result = await scanForSort(dir, { includeSubfolders: true })

    expect(result.files.map((f) => f.name)).toEqual(['sunset.jpg'])
  })

  it('should keep a project sealed even when looking inside folders', async () => {
    mkdirSync(join(dir, 'my-app'))
    writeFileSync(join(dir, 'my-app', 'package.json'), '{}')
    writeFileSync(join(dir, 'my-app', 'index.ts'), 'x')

    const result = await scanForSort(dir, { includeSubfolders: true })

    expect(result.files).toEqual([])
    expect(result.sealedFolders.map((f) => f.name)).toEqual(['my-app'])
  })

  it('should keep a project nested inside a plain folder sealed', async () => {
    mkdirSync(join(dir, 'Work', 'api'), { recursive: true })
    writeFileSync(join(dir, 'Work', 'notes.txt'), 'x')
    writeFileSync(join(dir, 'Work', 'api', 'Cargo.toml'), 'x')
    writeFileSync(join(dir, 'Work', 'api', 'main.rs'), 'x')

    const result = await scanForSort(dir, { includeSubfolders: true })

    expect(result.files.map((f) => f.name)).toEqual(['notes.txt'])
    expect(result.sealedFolders.map((f) => f.kind)).toEqual(['project'])
  })

  it('should not report a buried project when the scan stays shallow', async () => {
    mkdirSync(join(dir, 'Work', 'api'), { recursive: true })
    writeFileSync(join(dir, 'Work', 'api', 'Cargo.toml'), 'x')

    const result = await scanForSort(dir)

    expect(result.sealedFolders.map((f) => f.name)).toEqual(['Work'])
  })

  it('should count nothing when a folder holds only loose files', async () => {
    writeFileSync(join(dir, 'a.pdf'), 'x')

    const result = await scanForSort(dir)

    expect(result.nestedFileCount).toBe(0)
  })
})
