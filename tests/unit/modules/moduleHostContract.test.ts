import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { MODULE_HOST_DTS, moduleHostDeclarations } from '../../../scripts/module-host.mjs'

const SIGNING = join(__dirname, '../../../src/main/infrastructure/modules/signing.ts')

// What the modules repo relies on: both run outside Talyx, from a checkout of this repo.
describe('the module host contract the modules repo imports', () => {
  it('should match src/shared/moduleHost.ts in contract/module-host.d.ts (npm run module-host)', async () => {
    expect(readFileSync(MODULE_HOST_DTS, 'utf8')).toBe(await moduleHostDeclarations())
  })

  it('should import the signing checks from plain Node, with no Electron and no alias', () => {
    const script = `
      const { readLicense, readBundle, PUBLISHED_KEYS } = await import(${JSON.stringify(pathToFileURL(SIGNING).href)})
      console.log([typeof readLicense, typeof readBundle, Object.keys(PUBLISHED_KEYS).join()].join(' '))
    `
    const printed = execFileSync('node', ['--input-type=module', '--no-warnings', '-e', script], {
      encoding: 'utf8'
    })
    expect(printed.trim()).toBe('function function license,module')
  }, 20_000)
})
