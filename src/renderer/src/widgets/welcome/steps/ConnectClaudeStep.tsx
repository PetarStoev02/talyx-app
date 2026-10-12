import { useLanguage } from '@app/providers/useLanguage'
import { ConnectClaude } from '@features/assistant/ConnectClaude'

/**
 * First-run "connect your Claude, or skip" moment. Smart Local is already
 * sorting with nothing downloaded and nothing sent — this step is an
 * invitation, not a requirement, so Skip in the overlay's own footer carries
 * exactly as much weight as connecting here.
 *
 * Deliberately says nothing about what Claude sorting sends: connecting here
 * does not switch the sorter on — `sorterSource` stays `smart-local` until the
 * Sort-page offer is accepted or Settings is changed, and both of those show
 * the "sent" line at the moment the switch actually flips.
 */
export function ConnectClaudeStep(): React.JSX.Element {
  const t = useLanguage((s) => s.t)

  return (
    <div className="flex flex-col items-center text-center">
      <h2 className="text-xl font-semibold text-foreground mb-2">{t('welcome.connectTitle')}</h2>
      <p className="text-sm text-muted-foreground mb-4">{t('welcome.connectDesc')}</p>
      <div className="w-full text-left">
        <ConnectClaude />
      </div>
    </div>
  )
}
