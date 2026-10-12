import { describe, it, expect, vi } from 'vitest'
import { runJxa, type ExecFileFn } from '../../../src/main/infrastructure/agent/appleScript'

function exec(stdout: string, error: Error | null = null): ExecFileFn {
  return vi.fn((_file, _args, _options, callback) => {
    callback(error, stdout, '')
  }) as unknown as ExecFileFn
}

describe('runJxa', () => {
  it('should run the script through osascript in JavaScript mode and parse the JSON it prints', async () => {
    const fn = exec('{"ok":true,"items":[1,2]}')
    const result = await runJxa<{ ok: boolean; items: number[] }>(
      'JSON.stringify({ok:true})',
      ['a'],
      fn
    )
    expect(result).toEqual({ ok: true, items: [1, 2] })
    const [file, args, options] = (fn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(file).toBe('osascript')
    expect(args).toEqual(['-l', 'JavaScript', '-e', 'JSON.stringify({ok:true})', '--', 'a'])
    expect(options).toMatchObject({ timeout: 15000 })
  })

  it('should surface the app error text when osascript fails', async () => {
    const fn = exec(
      '',
      Object.assign(new Error('Command failed'), {
        stderr: 'execution error: Not authorized (-1743)'
      })
    )
    await expect(runJxa('x', [], fn)).rejects.toThrow('Not authorized')
  })

  it('should strip the osascript scaffolding so the error reads as the app wrote it', async () => {
    const fn = exec(
      '',
      Object.assign(new Error('Command failed'), {
        stderr: 'execution error: Error: Error: There is no calendar called Nope (-2700)'
      })
    )
    await expect(runJxa('x', [], fn)).rejects.toThrow(
      /^There is no calendar called Nope \(-2700\)$/
    )
  })

  it('should reject output that is not JSON', async () => {
    await expect(runJxa('x', [], exec('missing value'))).rejects.toThrow(/not JSON/)
  })

  it('should end options with -- so an argument starting with -e stays data', async () => {
    const fn = exec('[]')
    await runJxa('x', ['-eApp.doShellScript("touch /tmp/pwned")'], fn)
    const [, args] = (fn as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(args).toEqual([
      '-l',
      'JavaScript',
      '-e',
      'x',
      '--',
      '-eApp.doShellScript("touch /tmp/pwned")'
    ])
  })

  it.runIf(process.platform === 'darwin')(
    'should hand osascript an -e argument as argv, not as script',
    async () => {
      const argv = await runJxa<string[]>('function run(argv) { return JSON.stringify(argv) }', [
        '-e1+1'
      ])
      expect(argv).toEqual(['-e1+1'])
    }
  )
})
