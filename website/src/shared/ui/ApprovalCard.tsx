/** What Talyx shows before it acts: a change waits for Approve, a read runs at once. */
export interface Plan {
  summary: string
  steps: string[]
  needsApproval: boolean
}

// The real card's divider; this is a data-ui fragment of the app.
const ACTIONS_ROW =
  'flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-4 py-3 text-[13px] font-medium' // taste-skill-ignore

/** The assistant's approval card, rebuilt in HTML at true size. */
export function ApprovalCard({ plan }: { plan: Plan }) {
  return (
    <div
      data-ui
      className="card-swap w-full max-w-[560px] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-primary)]"
    >
      <p className="px-5 pt-4 text-[15px] font-medium">{plan.summary}</p>
      <ul className="space-y-1.5 px-5 pt-3 pb-4 text-[14px] tabular-nums text-[var(--color-text-secondary)]">
        {plan.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ul>
      <div className={ACTIONS_ROW}>
        {' '}
        {plan.needsApproval ? (
          <>
            <span className="rounded-md px-3 py-1.5 text-[var(--color-text-secondary)]">
              Deny <kbd className="ml-1 opacity-60">Esc</kbd>
            </span>
            <span className="rounded-md bg-[var(--color-btn-primary-bg)] px-3 py-1.5 text-[var(--color-btn-primary-text)]">
              Approve <kbd className="ml-1 opacity-60">↵</kbd>
            </span>
          </>
        ) : (
          <span className="px-1 py-1.5 text-[var(--color-text-secondary)]">
            Done, nothing changed
          </span>
        )}
      </div>
    </div>
  )
}
