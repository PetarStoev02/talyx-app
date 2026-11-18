import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import type { EventChannel, EventChannels, InvokeChannel, InvokeOutput } from '@contract/channels'

/**
 * Registers the handler of one channel in the table (@contract/channels). Its arguments arrive as
 * `unknown`, because any page script can send anything: validate each with `validateInput`. What
 * it answers must be the channel's output, or this does not compile.
 */
export function handle<C extends InvokeChannel>(
  channel: C,
  handler: (
    event: IpcMainInvokeEvent,
    ...args: unknown[]
  ) => InvokeOutput<C> | Promise<InvokeOutput<C>>
): void {
  ipcMain.handle(channel, handler)
}

/** Anything that sends events to a page: a window's webContents, or the dev bridge's stand-in. */
export interface EventSender {
  send: (channel: string, ...args: unknown[]) => void
}

export function sendEvent<C extends EventChannel>(
  sender: EventSender,
  channel: C,
  ...args: EventChannels[C]
): void {
  sender.send(channel, ...args)
}
