import { chmodSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { insideHome, isolatedEnv, isolatedRun, makeTempHome } from '../../smoke/isolation'

const homes: string[] = []

function tempHome(): string {
  const home = makeTempHome()
  homes.push(home)
  return home
}

function fakeEngine(home: string, script: string): string {
  const bin = join(home, '.local', 'bin')
  mkdirSync(bin, { recursive: true })
  const path = join(bin, 'talyx-engine')
  writeFileSync(path, `#!/bin/sh\n${script}\n`)
  chmodSync(path, 0o755)
  return path
}

afterEach(() => {
  for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true })
})

describe('smoke isolation', () => {
  describe('makeTempHome', () => {
    it('should make a fresh directory under /tmp, spelled as its real path', () => {
      const home = tempHome()

      expect(realpathSync(home)).toBe(home)
      expect(home.startsWith(`${realpathSync('/tmp')}/ts-`)).toBe(true)
    })
  })

  describe('isolatedEnv', () => {
    it('should hold only HOME, PATH, TMPDIR and LANG, all rooted in the temp home', () => {
      const env = isolatedEnv('/tmp/ts-abc')

      expect(Object.keys(env).sort()).toEqual(['HOME', 'LANG', 'PATH', 'TMPDIR'])
      expect(env.HOME).toBe('/tmp/ts-abc')
      expect(env.PATH).toBe('/tmp/ts-abc/.local/bin:/usr/bin:/bin:/usr/sbin:/sbin')
      expect(env.TMPDIR).toBe('/tmp/ts-abc')
      expect(env.LANG).toBe('en_US.UTF-8')
    })
  })

  describe('isolatedRun', () => {
    it.each(['talyx-engine', '/usr/bin/env', '/tmp/ts-other/.local/bin/talyx-engine'])(
      'should refuse %s, which is not the temp home engine',
      async (command) => {
        const run = isolatedRun(tempHome())

        await expect(run(command, ['--version'])).rejects.toThrow(`Smoke: refused ${command}`)
      }
    )

    it('should run the temp home engine with only the isolated env and report its exit', async () => {
      const home = tempHome()
      const engine = fakeEngine(home, 'printf "%s|%s|%s" "$HOME" "$USER" "$1"; exit 3')

      const result = await isolatedRun(home)(engine, ['--version'])

      expect(result).toEqual({ code: 3, stdout: `${home}||--version`, stderr: '' })
    })
  })

  describe('insideHome', () => {
    it('should accept the home itself and paths below it', () => {
      const home = tempHome()

      expect(insideHome(home, home)).toBe(true)
      expect(insideHome(home, join(home, 'a', 'b'))).toBe(true)
    })

    it('should accept a path spelled through a symlinked parent of the home', () => {
      const home = tempHome()

      // On macOS /tmp is a link to /private/tmp; the home is the resolved spelling.
      expect(insideHome(home, join('/tmp', basename(home), 'profile'))).toBe(true)
    })

    it('should reject paths that climb out with ..', () => {
      const home = tempHome()

      expect(insideHome(home, join(home, '..'))).toBe(false)
      expect(insideHome(home, `${home}/a/../../x`)).toBe(false)
    })

    it('should reject a sibling whose name only starts like the home', () => {
      const home = tempHome()

      expect(insideHome(home, `${home}-evil`)).toBe(false)
    })

    it('should reject a link inside the home that leads out of it', () => {
      const home = tempHome()
      symlinkSync('/usr', join(home, 'out'))

      expect(insideHome(home, join(home, 'out', 'bin'))).toBe(false)
    })
  })
})
