import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('splashApi', {
  onVersion: (cb: (version: string) => void) => {
    ipcRenderer.on('splash:version', (_e, version) => cb(version))
  },
  onStatus: (cb: (status: string) => void) => {
    ipcRenderer.on('splash:status', (_e, status) => cb(status))
  }
})
