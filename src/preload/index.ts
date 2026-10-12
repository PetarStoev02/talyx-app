import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { buildApi, type ApiTransport } from '../shared/api'

const windowControls = {
  platform: process.platform,
  // For the feedback issue: Chromium's user agent reports a frozen macOS version.
  systemVersion: process.getSystemVersion()
}

const ipcTransport: ApiTransport = {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, listener) => {
    const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]): void =>
      listener(...args)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },
  getPathForFile: (file) => webUtils.getPathForFile(file)
}

// Only these two objects reach the page. No raw ipcRenderer, no process.env:
// a script that ever ran in a renderer would otherwise get every channel and
// any API key the app was launched with.
contextBridge.exposeInMainWorld('electron', windowControls)
contextBridge.exposeInMainWorld('api', buildApi(ipcTransport))
