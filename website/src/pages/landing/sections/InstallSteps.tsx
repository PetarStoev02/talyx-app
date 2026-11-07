import { ASSETS } from '../../../shared/data/release'
import { SectionHeading, STEP, stagger } from '../../../shared/ui/page'

/** How to install and open Talyx: the same steps as the README. */
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
          On a Mac, open the DMG and drag Talyx to Applications, then open it. The build is signed
          with Developer ID and notarized by Apple, so macOS opens it like any other app.
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
