import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { SettingsStore } from '../../../src/main/infrastructure/storage/SettingsStore'

const DEFAULTS = {
  theme: 'dark',
  currentProjectId: null,
  staleMinutes: 15,
  launchAtLogin: false,
  funnelEnabled: false
}

describe('SettingsStore', () => {
  const dirs: string[] = []
  function settingsFile(): string {
    const dir = mkdtempSync(join(tmpdir(), 'talyx-settings-'))
    dirs.push(dir)
    return join(dir, 'settings.json')
  }

  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  it('returns defaults when the file is missing', () => {
    expect(new SettingsStore(settingsFile()).get()).toEqual(DEFAULTS)
  })

  it('falls back to defaults when the settings file is not an object', () => {
    for (const content of ['null', '5', '[1,2]', '"text"']) {
      const file = settingsFile()
      writeFileSync(file, content)
      expect(new SettingsStore(file).get()).toEqual(DEFAULTS)
    }
  })

  it('merges a patch and persists it', () => {
    const file = settingsFile()
    const updated = new SettingsStore(file).update({ staleMinutes: 30 })
    expect(updated).toEqual({ ...DEFAULTS, staleMinutes: 30 })
    expect(new SettingsStore(file).get().staleMinutes).toBe(30)
  })

  it('ignores unknown keys from an old settings file', () => {
    const file = settingsFile()
    writeFileSync(file, JSON.stringify({ defaultSortMode: 'move', staleMinutes: 20 }))
    const settings = new SettingsStore(file).get()
    expect(settings).toEqual({ ...DEFAULTS, staleMinutes: 20 })
    expect(settings).not.toHaveProperty('defaultSortMode')
  })

  it('replaces an invalid stored value with the default', () => {
    const file = settingsFile()
    writeFileSync(file, JSON.stringify({ theme: 'system', staleMinutes: 'x' }))
    expect(new SettingsStore(file).get()).toEqual(DEFAULTS)
  })
})
