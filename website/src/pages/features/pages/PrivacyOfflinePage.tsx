import { FeaturePageLayout } from '../FeaturePageLayout'
import { PRIVACY_LEDGER } from '../../../shared/data/privacy'
import { STEP } from '../../../shared/ui/page'

/** The few numbers that say what leaves the machine. */
function Ledger() {
  return (
    <dl className="space-y-8">
      {PRIVACY_LEDGER.map(({ figure, caption }) => (
        <div
          key={caption}
          className="grid grid-cols-[minmax(0,2fr)_minmax(0,5fr)] items-baseline gap-6"
        >
          <dt
            className="text-right leading-none font-semibold tracking-[-0.04em] text-[var(--color-text-primary)] tabular-nums"
            style={STEP.heading}
          >
            {figure}
          </dt>
          <dd className="text-[var(--color-text-primary)]" style={STEP.body}>
            {caption}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function PrivacyOfflinePage() {
  return (
    <FeaturePageLayout
      slug="privacy-offline"
      title="Your data, your rules"
      lead="Sorting asks one question, who reads your files, and defaults to the private answer. The optional assistant is separate and always uses your own Claude."
      figure={<Ledger />}
      stepsHeading="Who reads your files"
      steps={[
        {
          title: 'Smart Local, the default',
          description:
            'Nothing leaves your Mac. It classifies by file name, extension, size, and metadata already on your device. No model, no download, no network call, ever.'
        },
        {
          title: 'Your Claude, opt-in',
          description:
            'It reads only what needs reading: the files a reader could actually open, such as documents, spreadsheets, emails and plain text. It sends the file name, size, extension, and the first 2,000 characters of extracted text, with currency amounts, dates and company names ending in a legal suffix masked first, best-effort, to your own Anthropic account through your API key or your Claude Code sign-in.'
        },
        {
          title: 'The assistant, on your account',
          description:
            'What you type in the overlay, and the results of the abilities it calls, go to your own Claude and nowhere else. Screen control sends a screenshot only when you ask it to look. Talyx runs no model of its own and never sees any of it.'
        },
        {
          title: 'Everything else on the network',
          description:
            'The update check asks GitHub for a newer version and opens its release page. Voice models download from Hugging Face the first time you use voice. In Smart Local, nothing else leaves your Mac. There is no Talyx server and no account.'
        }
      ]}
      benefits={[
        {
          title: 'Private by default',
          description:
            'Smart Local, the default, never sends file content anywhere. Turn on Your Claude and only the files that need reading leave your machine, truncated and masked first.'
        },
        {
          title: 'Settings stay local',
          description:
            'All settings, history, and configurations are stored locally in a SQLite database on your machine. We never store your files or documents.'
        },
        {
          title: 'No telemetry',
          description:
            'We don’t collect usage data, analytics, or crash reports. Your workflow is your business.'
        },
        {
          title: 'No account required to sort',
          description:
            'Smart Local needs no API key, no cloud subscription, no sign-up, and no download. Install Talyx and start sorting. Your Claude is the one optional upgrade, from Settings.'
        }
      ]}
    />
  )
}
