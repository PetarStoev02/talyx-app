import type { DemoView } from '../../../app-demo/DemoApp'
import { AppEmbed } from '../../../features/app-demo/AppEmbed'
import { ABILITY_COUNT, EXTENSION_COUNT } from '../../../shared/data/offer'
import { SectionHeading, STEP, stagger, Wallpaper } from '../../../shared/ui/page'

interface Feature {
  view: DemoView
  /** Which part of the desktop shows behind the window. */
  wallpaper: string
  title: string
  paragraphs: string[]
}

const FEATURES: Feature[] = [
  {
    view: 'assistant',
    wallpaper: '20% 30%',
    title: `${ABILITY_COUNT} abilities, each with a fixed shape`,
    paragraphs: [
      'Calendar, mail, reminders, music, files and code. Claude can only ask for what an ability describes, so there is no free-run shell.',
      'When none fits, Talyx looks at the screen and clicks or types for you, with a card for every step.'
    ]
  },
  {
    view: 'sort',
    wallpaper: '80% 20%',
    title: 'Sorts by what the file is',
    paragraphs: [
      `Smart Local knows ${EXTENSION_COUNT} file types from their names and metadata, on first launch, and sends nothing anywhere.`,
      'Choose Your Claude in Settings and it reads the contents too. You see the whole plan before a file moves.'
    ]
  },
  {
    view: 'history',
    wallpaper: '40% 90%',
    title: 'Undo a whole batch',
    paragraphs: [
      'Every sort is recorded.',
      'Put one file or a whole batch back exactly where it came from, in one click.'
    ]
  },
  {
    view: 'watch',
    wallpaper: '90% 60%',
    title: 'Downloads sorts itself',
    paragraphs: [
      'Point Talyx at a folder and new files are sorted as they land.',
      'Notices are ranked and rare, and ⌘⇧Esc quiets them for the day.'
    ]
  }
]

/** Each capability shown by the real app screen that does it, text hanging beside it. */
export function FeaturesSection() {
  return (
    <section id="features" className="px-5 py-32 sm:px-8 md:py-48">
      <SectionHeading>What it does today.</SectionHeading>

      <div className="mt-16 space-y-24 md:space-y-32">
        {FEATURES.map(({ view, wallpaper, title, paragraphs }) => (
          <article key={view} className="grid items-start gap-6 md:grid-cols-12 md:gap-8">
            <div
              data-reveal
              className="relative isolate overflow-hidden rounded-2xl p-4 md:col-span-7 md:p-8"
            >
              <Wallpaper objectPosition={wallpaper} loading="lazy" />
              <AppEmbed view={view} width={980} height={640} title={`Talyx: ${title}`} />
            </div>
            <div
              data-reveal
              style={{ ...stagger(1), ...STEP.body }}
              className="max-w-[40ch] text-[var(--color-text-primary)] md:col-span-4 md:col-start-9"
            >
              <h3 className="leading-tight font-semibold" style={STEP.lead}>
                {title}
              </h3>
              {paragraphs.map((paragraph) => (
                <p key={paragraph} className="mt-3 leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
