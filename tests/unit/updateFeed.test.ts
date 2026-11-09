import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'

describe('release configuration', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
    version: string
    license: string
    dependencies: Record<string, string>
    scripts: Record<string, string>
  }

  it('should ship as 1.0.4 under the MIT licence', () => {
    expect(pkg.version).toBe('1.0.4')
    expect(pkg.license).toBe('MIT')
  })

  it('should update itself from the GitHub releases of this repository', () => {
    const config = readFileSync('electron-builder.yml', 'utf8')
    expect(pkg.dependencies['electron-updater']).toMatch(/^\d+\.\d+\.\d+$/)
    expect(config).toMatch(
      /^publish:\n {2}provider: github\n {2}owner: PetarStoev02\n {2}repo: talyx-app$/m
    )
    expect(config).toMatch(/- target: zip/)
    expect(config).toMatch(/writeUpdateInfo: false/)
    expect(existsSync('dev-app-update.yml')).toBe(false)
  })

  it('should never point at the retired Railway server', () => {
    expect(readFileSync('electron-builder.yml', 'utf8')).not.toMatch(/railway/i)
  })

  it('should sign with the hardened runtime and notarize the macOS build', () => {
    const config = readFileSync('electron-builder.yml', 'utf8')
    expect(config).not.toMatch(/identity:/)
    expect(config).toMatch(/notarize:\s*true/)
    expect(config).toMatch(/hardenedRuntime:\s*true/)
    expect(config).toMatch(/entitlements:\s*build\/entitlements\.mac\.plist/)
    expect(config).toMatch(/resetAdHocDarwinSignature:\s*true/)
  })

  it('should grant only the entitlements Electron and dictation need', () => {
    const plist = readFileSync('build/entitlements.mac.plist', 'utf8')
    const keys = [...plist.matchAll(/<key>([^<]+)<\/key>/g)].map((match) => match[1])
    expect(keys).toEqual([
      'com.apple.security.cs.allow-jit',
      'com.apple.security.device.audio-input'
    ])
  })
})
