import { contextBridge, ipcRenderer } from 'electron'
import type { EventChannels } from '@contract/channels'

type Version = EventChannels['splash:version']
type Status = EventChannels['splash:status']

contextBridge.exposeInMainWorld('splashApi', {
  onVersion: (cb: (...args: Version) => void) => {
    ipcRenderer.on('splash:version', (_e, ...args) => cb(...(args as Version)))
  },
  onStatus: (cb: (...args: Status) => void) => {
    ipcRenderer.on('splash:status', (_e, ...args) => cb(...(args as Status)))
  }
})
