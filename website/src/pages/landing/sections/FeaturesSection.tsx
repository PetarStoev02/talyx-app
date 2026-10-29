import type { DemoView } from '../../../app-demo/DemoApp'
import { AppEmbed } from '../../../features/app-demo/AppEmbed'
import { ABILITY_COUNT, EXTENSION_COUNT } from '../../../shared/data/offer'

interface Feature {
  view: DemoView
  /** Which part of the desktop shows behind the window. */
  wallpaper: string
  title: string
  body: string[]
}

const FEATURES: Feature[] = [
  {
    view: 'assistant',
    wallpaper: '20% 30%',
    title: `${ABILITY_COUNT} abilities, each with a fixed shape`,
    body: [
      'Calendar, mail, reminders, music, files and code. Claude can only ask for what an ability describes, so there is no free-run shell.',
      'When none fits, Talyx looks at the screen and clicks or types for you, with a card for every step.'
    ]
  },
  {
    view: 'sort',
    wallpaper: '80% 20%',
    title: 'Sorts by what the file is',
    body: [
      `Smart Local knows ${EXTENSION_COUNT} file types from their names and metadata, on first launch, and sends nothing anywhere.`,
      'Choose Your Claude in Settings and it reads the contents too. You see the whole plan before a file moves.'
    ]
  },
  {
    view: 'history',
    wallpaper: '40% 90%',
    title: 'Undo a whole batch',
    body: [
      'Every sort is recorded.',
      'Put one file or a whole batch back exactly where it came from, in one click.'
    ]
  },
  {
    view: 'watch',
    wallpaper: '90% 60%',
    title: 'Downloads sorts itself',
    body: [
      'Point Talyx at a folder and new files are sorted as they land.',
      'Notices are ranked and rare, and ⌘⇧Esc quiets them for the day.'
    ]
  }
]

/** Each capability shown by the real app screen that does it, text hanging beside it. */
export function FeaturesSection() {
  return (
    <section id="features" className="px-5 py-32 sm:px-8 md:py-48">
      <h2
        data-reveal
        className="leading-none font-semibold tracking-[-0.035em] text-[var(--color-text-primary)]"
        style={{ fontSize: 'var(--step-heading)' }}
      >
        What it does today.
      </h2>

      <div className="mt-16 space-y-24 md:space-y-32">
        {FEATURES.map(({ view, wallpaper, title, body }) => (
          <article key={view} className="grid items-start gap-6 md:grid-cols-12 md:gap-8">
            <div
              data-reveal
              className="relative isolate overflow-hidden rounded-2xl p-4 md:col-span-7 md:p-8"
            >
              <img
                src="/hero-wallpaper.jpg"
                alt=""
                width={2200}
                height={1238}
                loading="lazy"
                className="absolute inset-0 -z-10 size-full object-cover"
                style={{ objectPosition: wallpaper }}
              />
              <AppEmbed view={view} width={980} height={640} title={`Talyx: ${title}`} />
            </div>
            <div
              data-reveal
              style={{ '--i': 1, fontSize: 'var(--step-body)' } as React.CSSProperties}
              className="max-w-[40ch] text-[var(--color-text-primary)] md:col-span-4 md:col-start-9"
            >
              <h3 className="leading-tight font-semibold" style={{ fontSize: 'var(--step-lead)' }}>
                {title}
              </h3>
              {body.map((paragraph) => (
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
