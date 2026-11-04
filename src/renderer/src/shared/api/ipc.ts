// Typed wrappers around window.api exposed by preload

export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  sidebarCollapsed: boolean
}

export const settingsApi = {
  get: (): Promise<AppSettings> => window.api.getSettings() as Promise<AppSettings>,
  set: (partial: Partial<AppSettings>): Promise<AppSettings> =>
    window.api.setSettings(partial as Record<string, unknown>) as Promise<AppSettings>
}

export const updaterApi = {
  onUpdateAvailable: (cb: (info: { version: string; url: string }) => void): (() => void) =>
    window.api.onUpdateAvailable(cb)
}
