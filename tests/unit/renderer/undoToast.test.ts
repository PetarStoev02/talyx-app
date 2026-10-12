import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))

import { toast } from 'sonner'
import { announceUndo } from '../../../src/renderer/src/shared/lib/undoToast'

const t = (key: string): string => key

describe('announceUndo', () => {
  beforeEach(() => vi.clearAllMocks())

  it('should report a full undo as done', () => {
    expect(announceUndo({ ok: true, value: { reversed: 2, failed: [] } }, t)).toBe(true)
    expect(toast.success).toHaveBeenCalledWith('sort.undoComplete')
  })

  it('should warn, not celebrate, when some files were kept', () => {
    expect(announceUndo({ ok: true, value: { reversed: 1, failed: ['a.pdf: x'] } }, t)).toBe(true)
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.warning).toHaveBeenCalledOnce()
  })

  it('should report a refused undo as an error', () => {
    expect(announceUndo({ ok: false, error: 'already undone' }, t)).toBe(false)
    expect(toast.error).toHaveBeenCalledWith('already undone')
  })
})
