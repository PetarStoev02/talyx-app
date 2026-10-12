import type { Category } from '../model/Category'
import type { ClassificationResult } from '../model/ClassificationResult'

interface ExtensionMapping {
  category: Category
  subcategory: string | null
}

const EXTENSION_MAP: Record<string, ExtensionMapping> = {
  // Images
  jpg: { category: 'Images', subcategory: 'Photos' },
  jpeg: { category: 'Images', subcategory: 'Photos' },
  png: { category: 'Images', subcategory: 'Graphics' },
  gif: { category: 'Images', subcategory: 'Graphics' },
  bmp: { category: 'Images', subcategory: 'Graphics' },
  svg: { category: 'Images', subcategory: 'Graphics' },
  webp: { category: 'Images', subcategory: 'Photos' },
  tiff: { category: 'Images', subcategory: 'Photos' },
  ico: { category: 'Images', subcategory: 'Icons' },
  heic: { category: 'Images', subcategory: 'Photos' },
  raw: { category: 'Images', subcategory: 'Photos' },
  avif: { category: 'Images', subcategory: 'Photos' },
  eps: { category: 'Images', subcategory: 'Vectors' },
  ai: { category: 'Images', subcategory: 'Vectors' },
  psd: { category: 'Images', subcategory: 'Graphics' },
  xcf: { category: 'Images', subcategory: 'Graphics' },

  // Documents
  pdf: { category: 'Documents', subcategory: null },
  doc: { category: 'Documents', subcategory: null },
  docx: { category: 'Documents', subcategory: null },
  xls: { category: 'Documents', subcategory: 'Spreadsheets' },
  xlsx: { category: 'Documents', subcategory: 'Spreadsheets' },
  ppt: { category: 'Documents', subcategory: 'Presentations' },
  pptx: { category: 'Documents', subcategory: 'Presentations' },
  txt: { category: 'Documents', subcategory: null },
  rtf: { category: 'Documents', subcategory: null },
  odt: { category: 'Documents', subcategory: null },
  csv: { category: 'Documents', subcategory: 'Spreadsheets' },
  epub: { category: 'Documents', subcategory: 'Ebooks' },
  mobi: { category: 'Documents', subcategory: 'Ebooks' },
  pages: { category: 'Documents', subcategory: null },

  // Videos
  mp4: { category: 'Videos', subcategory: 'Movies' },
  avi: { category: 'Videos', subcategory: 'Movies' },
  mkv: { category: 'Videos', subcategory: 'Movies' },
  mov: { category: 'Videos', subcategory: 'Movies' },
  m4v: { category: 'Videos', subcategory: 'Movies' },
  wmv: { category: 'Videos', subcategory: 'Clips' },
  flv: { category: 'Videos', subcategory: 'Clips' },
  webm: { category: 'Videos', subcategory: 'Clips' },

  // Audio
  mp3: { category: 'Audio', subcategory: 'Music' },
  wav: { category: 'Audio', subcategory: 'Recordings' },
  flac: { category: 'Audio', subcategory: 'Music' },
  aac: { category: 'Audio', subcategory: 'Music' },
  ogg: { category: 'Audio', subcategory: 'Music' },
  wma: { category: 'Audio', subcategory: 'Music' },
  m4a: { category: 'Audio', subcategory: 'Music' },
  m4b: { category: 'Audio', subcategory: 'Podcasts' },
  opus: { category: 'Audio', subcategory: 'Recordings' },

  // Code
  js: { category: 'Code', subcategory: 'JavaScript' },
  jsx: { category: 'Code', subcategory: 'JavaScript' },
  mjs: { category: 'Code', subcategory: 'JavaScript' },
  ts: { category: 'Code', subcategory: 'TypeScript' },
  tsx: { category: 'Code', subcategory: 'TypeScript' },
  py: { category: 'Code', subcategory: 'Python' },
  css: { category: 'Code', subcategory: 'Web' },
  html: { category: 'Code', subcategory: 'Web' },
  scss: { category: 'Code', subcategory: 'Web' },
  less: { category: 'Code', subcategory: 'Web' },
  c: { category: 'Code', subcategory: 'Systems' },
  cpp: { category: 'Code', subcategory: 'Systems' },
  h: { category: 'Code', subcategory: 'Systems' },
  rs: { category: 'Code', subcategory: 'Systems' },
  go: { category: 'Code', subcategory: 'Systems' },
  json: { category: 'Code', subcategory: 'Data' },
  xml: { category: 'Code', subcategory: 'Data' },
  yaml: { category: 'Code', subcategory: 'Data' },
  yml: { category: 'Code', subcategory: 'Data' },
  toml: { category: 'Code', subcategory: 'Data' },
  sh: { category: 'Code', subcategory: 'Shell' },
  bash: { category: 'Code', subcategory: 'Shell' },
  zsh: { category: 'Code', subcategory: 'Shell' },
  ps1: { category: 'Code', subcategory: 'Shell' },
  java: { category: 'Code', subcategory: null },
  kt: { category: 'Code', subcategory: null },
  php: { category: 'Code', subcategory: null },
  rb: { category: 'Code', subcategory: null },
  md: { category: 'Documents', subcategory: null },

  // Software — Installers
  exe: { category: 'Software', subcategory: 'Installers' },
  msi: { category: 'Software', subcategory: 'Installers' },
  app: { category: 'Software', subcategory: 'Installers' },
  apk: { category: 'Software', subcategory: 'Installers' },
  appimage: { category: 'Software', subcategory: 'Installers' },
  snap: { category: 'Software', subcategory: 'Packages' },
  flatpak: { category: 'Software', subcategory: 'Packages' },
  dmg: { category: 'Software', subcategory: 'Disk Images' },
  iso: { category: 'Software', subcategory: 'Disk Images' },
  img: { category: 'Software', subcategory: 'Disk Images' },
  deb: { category: 'Software', subcategory: 'Packages' },
  rpm: { category: 'Software', subcategory: 'Packages' },
  pkg: { category: 'Software', subcategory: 'Packages' },

  // Software — Application Data (program artifacts, game data, runtime files)
  dll: { category: 'Software', subcategory: 'Application Data' },
  so: { category: 'Software', subcategory: 'Application Data' },
  dylib: { category: 'Software', subcategory: 'Application Data' },
  pdb: { category: 'Software', subcategory: 'Application Data' },
  lib: { category: 'Software', subcategory: 'Application Data' },
  sys: { category: 'Software', subcategory: 'Application Data' },
  drv: { category: 'Software', subcategory: 'Application Data' },
  ocx: { category: 'Software', subcategory: 'Application Data' },
  winmd: { category: 'Software', subcategory: 'Application Data' },
  mpq: { category: 'Software', subcategory: 'Application Data' },
  pak: { category: 'Software', subcategory: 'Application Data' },
  uasset: { category: 'Software', subcategory: 'Application Data' },
  umap: { category: 'Software', subcategory: 'Application Data' },
  upk: { category: 'Software', subcategory: 'Application Data' },
  unity3d: { category: 'Software', subcategory: 'Application Data' },
  assets: { category: 'Software', subcategory: 'Application Data' },
  rne: { category: 'Software', subcategory: 'Application Data' },
  tps: { category: 'Software', subcategory: 'Application Data' },
  wtf: { category: 'Software', subcategory: 'Application Data' },
  cur: { category: 'Software', subcategory: 'Application Data' },

  // Fonts
  ttf: { category: 'Other', subcategory: 'Fonts' },
  otf: { category: 'Other', subcategory: 'Fonts' },
  woff: { category: 'Other', subcategory: 'Fonts' },
  woff2: { category: 'Other', subcategory: 'Fonts' },

  // 3D Models
  blend: { category: 'Other', subcategory: '3D Models' },
  fbx: { category: 'Other', subcategory: '3D Models' },
  obj: { category: 'Other', subcategory: '3D Models' },
  dae: { category: 'Other', subcategory: '3D Models' },
  glb: { category: 'Other', subcategory: '3D Models' },
  gltf: { category: 'Other', subcategory: '3D Models' },
  mtl: { category: 'Other', subcategory: '3D Models' },
  stl: { category: 'Other', subcategory: '3D Models' },

  // CAD / Architecture
  dwg: { category: 'Other', subcategory: 'CAD' },
  dxf: { category: 'Other', subcategory: 'CAD' },
  rvt: { category: 'Other', subcategory: 'CAD' },
  pln: { category: 'Other', subcategory: 'CAD' },
  pla: { category: 'Other', subcategory: 'CAD' },
  bpn: { category: 'Other', subcategory: 'CAD' },
  tm: { category: 'Other', subcategory: 'CAD' },

  // Torrents / Downloads
  torrent: { category: 'Other', subcategory: 'Torrents' },

  // Archives
  zip: { category: 'Archives', subcategory: 'Compressed' },
  rar: { category: 'Archives', subcategory: 'Compressed' },
  '7z': { category: 'Archives', subcategory: 'Compressed' },
  tar: { category: 'Archives', subcategory: 'Compressed' },
  gz: { category: 'Archives', subcategory: 'Compressed' },
  bz2: { category: 'Archives', subcategory: 'Compressed' },
  xz: { category: 'Archives', subcategory: 'Compressed' }
}

export class ExtensionClassifier {
  classify(fileName: string): ClassificationResult {
    const ext = this.extractExtension(fileName)

    if (ext === null) {
      return {
        category: 'Other',
        subcategory: null,
        confidence: 0.5,
        metadata: {}
      }
    }

    const mapping = EXTENSION_MAP[ext]

    if (!mapping) {
      return {
        category: 'Other',
        subcategory: null,
        confidence: 0.5,
        metadata: { extension: ext }
      }
    }

    return {
      category: mapping.category,
      subcategory: mapping.subcategory,
      confidence: 1.0,
      metadata: { extension: ext }
    }
  }

  private extractExtension(fileName: string): string | null {
    const lastDot = fileName.lastIndexOf('.')
    if (lastDot === -1 || lastDot === fileName.length - 1) {
      return null
    }
    return fileName.slice(lastDot + 1).toLowerCase()
  }
}
