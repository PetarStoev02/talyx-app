import { toast } from 'sonner'

export interface UndoReply {
  ok: boolean
  value?: { reversed: number; failed: string[] }
  error?: string
}

type UndoKey = 'sort.undoComplete' | 'sort.undoFailed' | 'sort.undoPartial'
const MAX_LISTED = 3

/**
 * One message for every place that undoes a sort, so a partial undo is never
 * announced as done. Returns whether the batch is now marked undone.
 */
export function announceUndo(reply: UndoReply, t: (key: UndoKey) => string): boolean {
  if (!reply.ok) {
    toast.error(reply.error ?? t('sort.undoFailed'))
    return false
  }
  const failed = reply.value?.failed ?? []
  if (failed.length === 0) {
    toast.success(t('sort.undoComplete'))
    return true
  }
  toast.warning(t('sort.undoPartial').replace('{count}', String(failed.length)), {
    description: failed.slice(0, MAX_LISTED).join('\n')
  })
  return true
}
