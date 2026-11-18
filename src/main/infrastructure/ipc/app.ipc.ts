import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { app } from 'electron'
import log from 'electron-log'
import { diagnosticsReport, logTail } from '@contract/diagnostics'
import { EngineLabelSchema } from '@contract/channels'
import { handle } from './handle'
import { validateInput } from './validation'

const LOG_LINES = 50

/** Talyx's own version, and the redacted report "Copy diagnostics" puts on the clipboard. */
export function registerAppIpc(): void {
  handle('app:version', (): string => app.getVersion())
  // The page passes the engine state it already shows; main adds what only it can read.
  handle(
    'app:diagnostics',
    async (_event, rawEngine: unknown): Promise<string> =>
      diagnosticsReport({
        talyx: app.getVersion(),
        engine: validateInput(EngineLabelSchema, rawEngine),
        os: `${process.platform} ${process.getSystemVersion()} ${process.arch}`,
        log: logTail(await readLog(), LOG_LINES),
        home: homedir()
      })
  )
}

async function readLog(): Promise<string> {
  try {
    return await readFile(log.transports.file.getFile().path, 'utf8')
  } catch (error) {
    // No log file yet is a valid state: the report then says it has no log lines.
    log.warn('[Diagnostics] Could not read the log:', error)
    return ''
  }
}
