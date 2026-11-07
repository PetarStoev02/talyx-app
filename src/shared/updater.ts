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
  /**
   * True when Talyx downloads this release by itself and installs it on restart or quit (macOS
   * and AppImage, when the release has their latest-*.yml); false when the user opens the installer.
   */
  automatic: boolean
  /** True when the release has what the download needs: the update feed, or installer and SHA256SUMS. */
  downloadable: boolean
}

export type UpdateFailure = 'checksum' | 'network' | 'too-large' | 'other'

export type UpdateState =
  | { kind: 'none' }
  | { kind: 'available'; release: ReleaseSummary }
  | { kind: 'downloading'; release: ReleaseSummary; received: number; total: number }
  | { kind: 'ready'; release: ReleaseSummary }
  | { kind: 'failed'; release: ReleaseSummary; reason: UpdateFailure }
