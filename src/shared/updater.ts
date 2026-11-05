export interface Highlight {
  lead: string
  text: string
}

export interface ReleaseSummary {
  version: string
  url: string
  publishedAt: string
  highlights: Highlight[]
  changes: number
  /** True when this computer's installer and the release's SHA256SUMS are both there. */
  downloadable: boolean
}

export type UpdateFailure = 'checksum' | 'network' | 'too-large' | 'other'

export type UpdateState =
  | { kind: 'none' }
  | { kind: 'available'; release: ReleaseSummary }
  | { kind: 'downloading'; release: ReleaseSummary; received: number; total: number }
  | { kind: 'ready'; release: ReleaseSummary }
  | { kind: 'failed'; release: ReleaseSummary; reason: UpdateFailure }
