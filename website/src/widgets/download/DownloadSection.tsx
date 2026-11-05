import { ArrowRight } from 'lucide-react'
import { APP_VERSION, ASSETS, DOWNLOADS } from '../../shared/data/release'
import { MIN_MACOS } from '../../shared/data/offer'
import { GUTTER, STEP, stagger } from '../../shared/ui/page'

type Asset = keyof typeof ASSETS

const PLATFORMS: { name: string; main: [Asset, string]; other: [Asset, string] }[] = [
  {
    name: `${MIN_MACOS} or newer`,
    main: ['appleSilicon', 'Download for Apple Silicon'],
    other: ['intel', 'Download for Intel']
  },
  {
    name: 'Linux x64',
    main: ['appImage', 'Download the AppImage'],
    other: ['deb', 'Download the deb']
  }
]

const REQUIREMENTS = [
  { need: 'A computer', detail: `A Mac with ${MIN_MACOS} or newer, or Linux x64.` },
  { need: 'The engine', detail: 'First-run setup installs it, for your user only.' },
  { need: 'A model', detail: 'An API key or a sign-in with your provider account.' }
]

/** Every link here is a real file; the click listener reads which one from `data-asset`. */
function downloadProps(asset: Asset) {
  return { href: DOWNLOADS[asset], 'data-cta': 'download', 'data-asset': ASSETS[asset] }
}

/** The close, in inverted colours: what you need, then the file for your computer. */
export function DownloadSection() {
  return (
    <section
      id="download"
      className={`flex min-h-[90svh] flex-col justify-between gap-20 bg-[var(--color-text-primary)] ${GUTTER} py-24 text-[var(--color-bg)] md:py-32`}
    >
      <h2
        data-reveal
        className="leading-[0.92] font-semibold tracking-[-0.045em]"
        style={STEP.display}
      >
        <span className="block">Download</span>
        <span className="block">Talyx.</span>
      </h2>

      <div className="grid gap-14 md:grid-cols-12">
        <div data-reveal className="md:col-span-6" style={STEP.body}>
          <p className="max-w-[40ch]" style={STEP.lead}>
            Free and open source under MIT. No account and no card.
          </p>
          <dl className="mt-10 space-y-5">
            {REQUIREMENTS.map(({ need, detail }) => (
              <div key={need} className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-6">
                <dt className="font-semibold">{need}</dt>
                <dd>{detail}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div
          data-reveal
          style={stagger(1)}
          className="grid content-start gap-10 sm:grid-cols-2 md:col-span-6"
        >
          {PLATFORMS.map(({ name, main, other }) => (
            <div key={name} className="flex flex-col items-start gap-3">
              <h3 className="font-semibold" style={STEP.lead}>
                {name}
              </h3>
              <a
                {...downloadProps(main[0])}
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--color-bg)] px-6 text-[17px] font-semibold text-[var(--color-text-primary)] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
              >
                {main[1]}
                <ArrowRight className="size-4" />
              </a>
              <a
                {...downloadProps(other[0])}
                className="inline-flex min-h-11 items-center text-[17px] font-medium underline underline-offset-4 transition-opacity hover:opacity-70"
              >
                {other[1]}
              </a>
            </div>
          ))}
          <p className="text-[14px] opacity-75 sm:col-span-2">
            Version {APP_VERSION}. Not sure which Mac you have? Apple menu, About This Mac: it shows
            Chip for Apple Silicon or Processor for Intel. Windows comes later.
          </p>
        </div>
      </div>

      <p
        data-reveal
        className="max-w-[90ch] leading-relaxed opacity-75 [&_code]:rounded [&_code]:bg-[color-mix(in_srgb,var(--color-bg)_14%,transparent)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[15px]"
        style={STEP.body}
      >
        Builds are not signed. On a Mac, open Talyx once, then click Open Anyway in System Settings,
        Privacy &amp; Security, or run{' '}
        <code>xattr -dr com.apple.quarantine /Applications/Talyx.app</code>. On Linux, run{' '}
        <code>chmod +x Talyx-x86_64.AppImage</code>, or install the deb with{' '}
        <code>sudo apt install ./Talyx-amd64.deb</code>.
      </p>
    </section>
  )
}
