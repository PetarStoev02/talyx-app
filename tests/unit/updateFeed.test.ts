import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'

describe('release configuration', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
    version: string
    license: string
    dependencies: Record<string, string>
    scripts: Record<string, string>
  }

  it('should ship as 0.11.0 under the MIT licence', () => {
    expect(pkg.version).toBe('0.11.0')
    expect(pkg.license).toBe('MIT')
  })

  it('should not depend on an installer that needs a signed app', () => {
    expect(pkg.dependencies['electron-updater']).toBeUndefined()
    expect(existsSync('dev-app-update.yml')).toBe(false)
  })

  it('should never point at the retired Railway server', () => {
    expect(readFileSync('electron-builder.yml', 'utf8')).not.toMatch(/railway/i)
  })

  it('should build ad-hoc signed DMGs without notarization', () => {
    const config = readFileSync('electron-builder.yml', 'utf8')
    expect(config).toMatch(/identity:\s*'-'/)
    expect(config).toMatch(/notarize:\s*false/)
    expect(config).toMatch(/hardenedRuntime:\s*false/)
    expect(config).not.toMatch(/target:\s*zip/)
    expect(config).not.toMatch(/entitlements/)
    expect(config).toMatch(/^publish:\s*null/m)
  })
})
