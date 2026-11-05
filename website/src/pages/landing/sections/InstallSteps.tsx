import { ASSETS } from '../../../shared/data/release'
import { SectionHeading, STEP, stagger } from '../../../shared/ui/page'

/** How to open a build that is not signed: the same steps as the release notes. */
export function InstallSteps() {
  return (
    <section id="install" className="grid gap-12 px-5 py-32 sm:px-8 md:grid-cols-12 md:py-40">
      <SectionHeading className="md:col-span-5">Opening it the first time.</SectionHeading>
      <ol
        data-reveal
        className="list-decimal space-y-5 pl-6 leading-relaxed text-[var(--color-text-primary)] md:col-span-6 md:col-start-7 [&_code]:rounded [&_code]:bg-[var(--color-bg-secondary)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[15px] [&_strong]:font-semibold"
        style={{ ...stagger(1), ...STEP.body }}
      >
        <li>
          On a Mac, open the DMG and drag Talyx to Applications. Open Talyx and dismiss the warning:
          the build is not signed, so macOS blocks it the first time.
        </li>
        <li>
          Go to <strong>System Settings, Privacy &amp; Security</strong>, scroll down and click{' '}
          <strong>Open Anyway</strong>. macOS asks for your password. Or run this once in Terminal:{' '}
          <code>xattr -dr com.apple.quarantine /Applications/Talyx.app</code>
        </li>
        <li>
          On Linux, make the AppImage executable with <code>chmod +x {ASSETS.appImage}</code> and
          run it, or install the deb with <code>sudo apt install ./{ASSETS.deb}</code>. Linux shows
          no warning.
        </li>
        <li>
          Setup then installs the engine, asks for a model provider and helps you make your first
          bot.
        </li>
        <li>
          When a new version is out, Talyx tells you. Click Download and it fetches the installer,
          checks it against the release’s <code>SHA256SUMS</code> and opens it for you to run. A deb
          install updates from the release page instead.
        </li>
      </ol>
    </section>
  )
}
