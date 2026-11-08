import { describe, expect, it } from 'vitest'
import { diagnosticsReport, logTail, redactSecrets } from '../../../src/shared/diagnostics'

const HOME = '/Users/someone'

function report(log: string, engine: string | null = '0.9.0'): string {
  return diagnosticsReport({
    talyx: '1.0.2',
    engine,
    os: 'darwin 16.0 arm64',
    log,
    home: HOME
  })
}

describe('diagnostics', () => {
  describe('report', () => {
    it('should list the Talyx version, the engine version, the OS and the log', () => {
      const text = report('[info] Talyx started')
      expect(text).toContain('Talyx 1.0.2')
      expect(text).toContain('Engine 0.9.0')
      expect(text).toContain('OS darwin 16.0 arm64')
      expect(text).toContain('[info] Talyx started')
    })

    it('should say the engine is not found when there is no engine version', () => {
      expect(report('', null)).toContain('Engine not found')
    })

    it('should say the log is empty when there are no log lines', () => {
      expect(report('')).toContain('(no log lines)')
    })

    it('should replace the home folder with ~ so the user name stays out', () => {
      const text = report(`[warn] Command not found ${HOME}/.local/bin/talyx-engine`)
      expect(text).toContain('~/.local/bin/talyx-engine')
      expect(text).not.toContain(HOME)
    })
  })

  describe('redaction', () => {
    const secrets: Array<[string, string, string]> = [
      ['an OpenAI style key', 'using sk-proj-abcdEFGH1234ijklMNOP5678', 'sk-proj-abcdEFGH1234'],
      ['an Anthropic key', 'key sk-ant-api03-AbCdEfGh_IjKlMnOp-QrStUv', 'sk-ant-api03-AbCdEfGh'],
      ['a bearer token', 'Authorization: Bearer abc.def.ghi', 'abc.def.ghi'],
      ['an api_key field', '{"api_key":"hunter2-value"}', 'hunter2-value'],
      ['a token= query', 'GET /x?token=s3cr3tvalue&x=1', 's3cr3tvalue'],
      ['a password field', 'password: correct-horse', 'correct-horse'],
      ['a secret env line', 'OPENROUTER_API_KEY=or-v1-1234567890abcdef', 'or-v1-1234567890abcdef'],
      ['a client secret', 'client_secret = "abcd1234"', 'abcd1234'],
      ['a GitHub token', 'gh auth ghp_abcdefghijklmnopqrstuvwxyz0123456789', 'ghp_abcdefghij'],
      ['a Google key', 'AIzaSyA-1234567890abcdefghijklmnopqrstu', 'AIzaSyA-1234567890'],
      ['an AWS key id', 'AKIAIOSFODNN7EXAMPLE', 'AKIAIOSFODNN7EXAMPLE'],
      [
        'a JWT',
        'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
        'eyJhbGciOiJIUzI1NiJ9'
      ],
      ['a password in a URL', 'proxy https://bob:pa55w0rd@proxy.local:8080', 'pa55w0rd'],
      [
        'a long opaque token',
        'ticket ZXhhbXBsZS10aWNrZXQtdmFsdWUtdGhhdC1pcy1sb25n',
        'ZXhhbXBsZS10aWNr'
      ]
    ]

    it.each(secrets)('should hide %s', (_name, line, secret) => {
      const text = redactSecrets(line)
      expect(text).not.toContain(secret)
      expect(text).toContain('[redacted]')
    })

    it('should hide secrets anywhere in the report, not only in the log', () => {
      const text = diagnosticsReport({
        talyx: '1.0.2',
        engine: 'sk-ant-api03-leakedFromAWeirdPlace123',
        os: 'linux',
        log: '',
        home: HOME
      })
      expect(text).not.toContain('leakedFromAWeirdPlace')
    })

    it('should keep ordinary log lines readable', () => {
      const line = '[2026-11-08 10:00:00.123] [info] [Engine] Attached, version 0.9.0'
      expect(redactSecrets(line)).toBe(line)
    })
  })

  describe('log tail', () => {
    it('should keep only the last lines of the log', () => {
      const log = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`).join('\n') + '\n'
      expect(logTail(log, 3)).toBe('line 8\nline 9\nline 10')
    })

    it('should keep every line of a short log', () => {
      expect(logTail('one\ntwo', 50)).toBe('one\ntwo')
    })

    it('should return nothing for an empty log', () => {
      expect(logTail('', 50)).toBe('')
    })
  })
})
