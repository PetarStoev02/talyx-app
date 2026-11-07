import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'

describe('release configuration', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
    version: string
    license: string
    dependencies: Record<string, string>
    scripts: Record<string, string>
  }

  it('should ship as 1.0.0 under the MIT licence', () => {
    expect(pkg.version).toBe('1.0.0')
    expect(pkg.license).toBe('MIT')
  })

  it('should not depend on an installer that needs a signed app', () => {
    expect(pkg.dependencies['electron-updater']).toBeUndefined()
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
    expect(config).not.toMatch(/target:\s*zip/)
    expect(config).toMatch(/^publish:\s*null/m)
  })

  it('should grant only the entitlements Electron and dictation need', () => {
    const plist = readFileSync('build/entitlements.mac.plist', 'utf8')
    const keys = [...plist.matchAll(/<key>([^<]+)<\/key>/g)].map((match) => match[1])
    expect(keys).toEqual([
      'com.apple.security.cs.allow-jit',
      'com.apple.security.cs.allow-unsigned-executable-memory',
      'com.apple.security.device.audio-input'
    ])
  })
})
