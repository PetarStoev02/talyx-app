export interface FileEntry {
  name: string
  path: string
  extension: string
  size: number
  modifiedAt: Date
  category?: string
  subcategory?: string
  confidence?: number
}
