import type { TalyxApi } from '../shared/api'

declare global {
  interface Window {
    /**
     * `bridged` only in a plain browser tab driving a dev run through the dev bridge, which has
     * no `pathOf`: a page in a browser never learns where a file is on disk.
     */
    electron: { platform: string; bridged?: boolean; pathOf?: (file: File) => string }
    api: TalyxApi
  }
}
