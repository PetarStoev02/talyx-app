import { SectionHeading, STEP, stagger } from '../../../shared/ui/page'

/** How to open an app that is not notarized: the same steps as the README. */
export function InstallSteps(): React.JSX.Element {
  return (
    <section id="install" className="grid gap-12 px-5 py-32 sm:px-8 md:grid-cols-12 md:py-40">
      <SectionHeading className="md:col-span-5">Opening it the first time.</SectionHeading>
      <ol
        data-reveal
        className="list-decimal space-y-5 pl-6 leading-relaxed text-[var(--color-text-primary)] md:col-span-6 md:col-start-7 [&_code]:rounded [&_code]:bg-[var(--color-bg-secondary)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[15px] [&_code]:break-all [&_strong]:font-semibold"
        style={{ ...stagger(1), ...STEP.body }}
      >
        <li>
          Open the DMG and drag Talyx to Applications. Then open Talyx. macOS blocks it, because
          Talyx is not notarized by Apple, so dismiss the warning.
        </li>
        <li>
          Go to <strong>System Settings, Privacy &amp; Security</strong>, scroll down and click{' '}
          <strong>Open Anyway</strong>. macOS asks for your Mac password. Or run this once in
          Terminal: <code>xattr -dr com.apple.quarantine /Applications/Talyx.app</code>
        </li>
        <li>
          Every new version you download is blocked the same way the first time you open it. Talyx
          tells you when a new version is out and opens its page; it never installs anything itself.
        </li>
        <li>
          After installing a new version, macOS asks again for Automation and Files &amp; Folders.
          For Accessibility and Screen Recording, the old Talyx entry stays switched on but stops
          working: remove it with “−” and add Talyx again.
        </li>
        <li>
          Talyx is not hardened or notarized, so software already running as you could inject code
          into it. Grant permissions accordingly.
        </li>
      </ol>
    </section>
  )
}
