import { describe, it, expect, vi } from 'vitest'
import { RecordSignal } from '../../../src/main/domain/office/useCases/RecordSignal'
import { UnknownBotError } from '../../../src/main/domain/office/errors'
import type { BotSignal } from '../../../src/main/domain/office/model'
import type { SignalRepo } from '../../../src/main/domain/office/repository/SignalRepo'
import type { RosterRepo } from '../../../src/main/domain/office/repository/RosterRepo'

const signal: BotSignal = { kind: 'idle', botId: 'b1', at: '2026-01-01T00:00:00Z' }
const setup = (): {
  append: ReturnType<typeof vi.fn>
  onChange: ReturnType<typeof vi.fn>
  uc: RecordSignal
} => {
  const append = vi.fn()
  const onChange = vi.fn()
  const roster = { allBots: () => [{ id: 'b1', projectId: 'p1' }] } as unknown as RosterRepo
  const uc = new RecordSignal({ signals: { append } as unknown as SignalRepo, roster, onChange })
  return { append, onChange, uc }
}

describe('RecordSignal', () => {
  it('should store the signal and notify its project', () => {
    const { append, onChange, uc } = setup()
    uc.execute(signal)
    expect(append).toHaveBeenCalledWith(signal)
    expect(onChange).toHaveBeenCalledWith('p1')
  })

  it('should throw UnknownBotError and store nothing for an unknown bot', () => {
    const { append, onChange, uc } = setup()
    expect(() => uc.execute({ ...signal, botId: 'zzz' })).toThrow(UnknownBotError)
    expect(append).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })
})
