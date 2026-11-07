import { FeaturePageLayout } from '../FeaturePageLayout'
import { PRIVACY_LEDGER, SITE_ANALYTICS } from '../../../shared/data/privacy'
import { STEP } from '../../../shared/ui/page'

/** The few numbers that say what leaves the computer, beside the lead. */
function Ledger() {
  return (
    <dl className="space-y-8">
      {PRIVACY_LEDGER.map(({ figure, counted, detail }) => (
        <div
          key={counted}
          className="grid grid-cols-[3rem_1fr] items-baseline gap-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,5fr)] sm:gap-6"
        >
          <dt
            className="text-right leading-none font-semibold tracking-[-0.04em] text-[var(--color-text-primary)] tabular-nums"
            style={STEP.heading}
          >
            {figure}
          </dt>
          <dd className="text-[var(--color-text-primary)]" style={STEP.body}>
            <span className="font-semibold">{counted}.</span> {detail}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function PrivacyPage() {
  return (
    <FeaturePageLayout
      slug="privacy"
      title="Where your chats go."
      lead="Your chats pass from Talyx to the engine on your computer, and from there to the model provider each bot uses, under that provider’s terms. A bot’s tools can reach other services too. Talyx has no server and sends your chats nowhere else."
      figure={<Ledger />}
      stepsHeading="Where it goes"
      steps={[
        {
          title: 'Your chats',
          description:
            'Each bot sends its conversation, with any images you add, to the model provider it uses. You choose the provider in Settings.'
        },
        {
          title: 'A bot’s tools',
          description:
            'Web search, a command the bot runs and its other tools can reach other services. Some ask for your approval first, in a card in the chat.'
        },
        {
          title: 'Your keys and sign-ins',
          description:
            'The engine stores them on your computer. Talyx hands them over when you add a provider and keeps no copy.'
        },
        {
          title: 'Release checks and downloads',
          description:
            'Talyx asks GitHub whether a newer release exists. On macOS and in the AppImage it downloads the update in the background and checks it against the release’s checksums; on a Mac the new build must also carry the same Developer ID signature. Nothing installs until you restart Talyx or quit it.'
        },
        {
          title: 'This website',
          description: `${SITE_ANALYTICS} The app counts nothing.`
        }
      ]}
      benefitsHeading="What you can check"
      benefits={[
        {
          title: 'No account',
          description: 'There is nothing to sign up for. Download Talyx, open it and add a bot.'
        },
        {
          title: 'No telemetry',
          description:
            'The app collects no usage data and sends no crash reports. The engine has its own anonymous usage metrics. They are off by default, and Talyx never turns them on.'
        },
        {
          title: 'Open source',
          description:
            'Every line of Talyx is on GitHub under the MIT licence, so each claim on this page can be checked.'
        }
      ]}
    />
  )
}
