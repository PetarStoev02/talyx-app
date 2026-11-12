import { useRef } from 'react'
import { useLanguage } from '@app/providers/useLanguage'
import { useApprovals } from '@features/bots/approvals'
import { Button } from '@shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@shared/ui/dialog'

/** Asks the user before an agent's tool call that loses data; closing it is a no. */
export function ApprovalDialog(): React.JSX.Element {
  const t = useLanguage((s) => s.t)
  const request = useApprovals((s) => s.queue[0] ?? null)
  const { answer } = useApprovals.getState()
  // Deny takes the focus: Enter on a dialog that opened by itself must never delete anything.
  const deny = useRef<HTMLButtonElement>(null)
  return (
    <Dialog
      open={!!request}
      onOpenChange={(open) => {
        if (!open) answer(false)
      }}
    >
      <DialogContent
        // A new request mounts a new content, so Deny takes the focus again: a second click meant
        // for the request before can never allow one the user has not read.
        key={request?.id}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          deny.current?.focus()
        }}
      >
        <DialogTitle>{t('mcp.approveTitle')}</DialogTitle>
        <p className="text-base">{request?.action}</p>
        <DialogDescription>{t('mcp.approveSource')}</DialogDescription>
        <div className="flex gap-2">
          <Button variant="destructive" onClick={() => answer(true)}>
            {t('mcp.allow')}
          </Button>
          <Button ref={deny} variant="ghost" onClick={() => answer(false)}>
            {t('mcp.deny')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
