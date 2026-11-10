import type { TalyxApi } from '../shared/api'

declare global {
  interface Window {
    /** `bridged` only in a plain browser tab driving a dev run through the dev bridge. */
    electron: { platform: string; bridged?: boolean }
    api: TalyxApi
  }
}
