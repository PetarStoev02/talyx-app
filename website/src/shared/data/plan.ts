/** What Talyx shows before it acts: a change waits for Approve, a read runs at once. */
export interface Plan {
  summary: string
  steps: string[]
  needsApproval: boolean
}
