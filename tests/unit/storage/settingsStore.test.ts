import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import fc from 'fast-check'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const userData = vi.hoisted(() => ({ dir: '' }))
// The byte count the next file write stops at, as a crash would cut it; null writes whole.
const crash = vi.hoisted(() => ({ after: null as number | null }))

vi.mock('electron', () => ({ app: { getPath: () => userData.dir } }))
vi.mock('fs', async (importOriginal) => {
  const fs = await importOriginal<typeof import('fs')>()
  return {
    ...fs,
    writeFileSync: (path: string, text: string) => {
      if (crash.after === null) return fs.writeFileSync(path, text)
      fs.writeFileSync(path, Buffer.from(text).subarray(0, crash.after))
      throw new Error('crashed mid-write')
    }
  }
})

import {
  settingsStore,
  type UserSettings
} from '../../../src/main/infrastructure/storage/SettingsStore'

const settings: fc.Arbitrary<Partial<UserSettings>> = fc.record(
  {
    theme: fc.constantFrom<UserSettings['theme']>('light', 'dark', 'system'),
    enginePath: fc.constantFrom(null, '/opt/engine/bin/talyx-engine'),
    setupDone: fc.boolean(),
    launchAtLogin: fc.boolean(),
    completionSound: fc.boolean(),
    sidebarLayout: fc.constantFrom('dock', 'layered'),
    licenseKey: fc.option(fc.string({ maxLength: 40 }))
  },
  { requiredKeys: [] }
)

describe('settings store, for a write cut off after any number of bytes', () => {
  beforeEach(() => {
    userData.dir = mkdtempSync(join(tmpdir(), 'talyx-settings-'))
    crash.after = null
  })

  afterEach(() => rmSync(userData.dir, { recursive: true, force: true }))

  it('should never leave half a settings.json behind a crash mid-write', () => {
    fc.assert(
      fc.property(settings, settings, fc.nat(), (before, after, cut) => {
        settingsStore.set(before)
        const old = settingsStore.store
        const whole = JSON.stringify({ ...old, ...after }, null, 2)

        crash.after = cut % (Buffer.byteLength(whole) + 1)
        expect(() => settingsStore.set(after)).toThrow('crashed mid-write')
        crash.after = null

        const file = JSON.parse(readFileSync(join(userData.dir, 'settings.json'), 'utf-8'))
        expect([old, { ...old, ...after }]).toContainEqual(file)
        expect(settingsStore.store).toEqual(file)
        expect(readdirSync(userData.dir).filter((name) => name.includes('corrupt'))).toEqual([])
      })
    )
  })
})
