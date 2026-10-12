import type { TalyxApi } from '../shared/api'

declare global {
  interface Window {
    electron: { platform: string; systemVersion: string }
    api: TalyxApi
  }
}
