import { describe, expect, it } from 'vitest'
import type { EngineStatus } from '../../../src/shared/engine'
import { engineLabel, engineSummary } from '@features/setup/engineSummary'

const path = '/usr/local/bin/talyx-engine'

function attached(version: string, stale = false): EngineStatus {
  return {
    state: 'attached',
    version,
    commit: null,
    home: 'default',
    path,
    stale,
    botMetaKey: 'k',
    botGroupsMetaKey: 'g',
    managerHandle: 'talyx'
  }
}

function failed(version: string | null, reason: 'protocol' | null): EngineStatus {
  return { state: 'error', message: 'no socket', version, reason }
}

describe('engineSummary', () => {
  it.each([
    ['before the first check', null, 'checking', null, null],
    ['missing', { state: 'missing', enginePath: null } as EngineStatus, 'missing', null, 'install'],
    ['attached, current', attached('0.22.7'), 'attached', '0.22.7', null],
    ['attached, newer', attached('0.23.0'), 'attached', '0.23.0', null],
    ['attached, older', attached('0.22.6'), 'attached', '0.22.6', 'update'],
    ['attached, unreadable version', attached('weird'), 'attached', 'weird', null],
    ['error, version unknown', failed(null, null), 'error', null, 'install'],
    ['error, older engine', failed('0.21.0', null), 'error', '0.21.0', 'update'],
    ['protocol, older engine', failed('0.21.0', 'protocol'), 'protocol', '0.21.0', 'update'],
    ['protocol, same version', failed('0.22.7', 'protocol'), 'protocol', '0.22.7', null],
    ['protocol, newer engine', failed('0.23.0', 'protocol'), 'protocol', '0.23.0', null]
  ])('should summarize %s', (_name, status, state, version, action) => {
    expect(engineSummary(status)).toMatchObject({ state, version, action })
  })

  it('should carry the path, stale flag and newer note of an attached engine', () => {
    expect(engineSummary(attached('0.23.0', true))).toMatchObject({
      path,
      stale: true,
      newer: true
    })
    expect(engineSummary(attached('0.22.7'))).toMatchObject({ stale: false, newer: false })
  })

  it('should carry the message of an error and no path', () => {
    expect(engineSummary(failed(null, null))).toMatchObject({ message: 'no socket', path: null })
  })
})

describe('engineLabel', () => {
  it.each([
    ['attached', engineSummary(attached('0.22.7')), '0.22.7'],
    ['missing', engineSummary({ state: 'missing', enginePath: null } as EngineStatus), 'not found'],
    ['before the first check', engineSummary(null), 'checking'],
    ['failing with a version', engineSummary(failed('0.22.7', null)), 'error (0.22.7)'],
    ['failing without a version', engineSummary(failed(null, null)), 'error'],
    ['on another protocol', engineSummary(failed('0.30.0', 'protocol')), 'protocol (0.30.0)']
  ])('should describe an engine that is %s', (_name, summary, label) => {
    expect(engineLabel(summary)).toBe(label)
  })
})
