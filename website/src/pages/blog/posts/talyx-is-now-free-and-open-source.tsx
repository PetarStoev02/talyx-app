export function TalyxIsNowFreeAndOpenSource(): React.JSX.Element {
  return (
    <>
      <p>
        I built Talyx on my own for almost two years. It started as a file organizer and grew into a
        personal harness: your own Claude operating your Mac through typed abilities, with every
        action that changes something behind an approval card you read and click.
      </p>
      <p>
        Big tech companies now ship assistants like this with their own models, their own
        distribution and teams of hundreds. One person can&apos;t compete with that, and I&apos;d
        rather Talyx be used than sit behind a paywall. So from version 0.11 it is free and open
        source under the MIT licence.
      </p>
      <h2>What changes</h2>
      <ul>
        <li>No trial, no activation, no account, nothing to buy. Every feature is yours.</li>
        <li>
          The source is on <a href="https://github.com/PetarStoev02/talyx-app">GitHub</a>. Read it,
          fork it, learn from it, build on it.
        </li>
        <li>
          Releases are published on GitHub. Talyx tells you when a new version is out and opens its
          page; it never installs anything itself.
        </li>
        <li>
          Feedback goes to{' '}
          <a href="https://github.com/PetarStoev02/talyx-app/issues">GitHub Issues</a>.
        </li>
      </ul>
      <h2>What stays the same</h2>
      <ul>
        <li>
          You bring the brain: your own Claude, through an API key or your signed-in Claude Code.
          Talyx runs no model and hosts nothing.
        </li>
        <li>Smart Local sorting still sends nothing anywhere.</li>
        <li>
          Every change the assistant makes to your files, mail or calendar still waits for your
          approval.
        </li>
      </ul>
      <h2>One thing to know before you install</h2>
      <p>
        Talyx is not notarized by Apple any more, so macOS blocks it the first time you open each
        new version. Open it once, dismiss the warning, then go to System Settings → Privacy &amp;
        Security and click Open Anyway. The <a href="/#download">download section</a> has the full
        steps, including what to do about permissions after an update.
      </p>
      <p>— Petar</p>
    </>
  )
}
