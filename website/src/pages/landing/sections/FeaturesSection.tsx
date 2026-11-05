import { useSyncExternalStore } from 'react'
import type { DemoView } from '../../../app-demo/DemoApp'
import { AppEmbed } from '../../../features/app-demo/AppEmbed'
import { SectionHeading, STEP, stagger, Wallpaper } from '../../../shared/ui/page'

interface Feature {
  view: DemoView
  /** The same screen as a still, for phones. */
  preview: string
  /** Which part of the desktop shows behind the window. */
  wallpaper: string
  title: string
  paragraphs: string[]
}

const FEATURES: Feature[] = [
  {
    view: 'chat',
    preview: '/previews/chat.jpg',
    wallpaper: '20% 30%',
    title: 'One roster, one chat',
    paragraphs: [
      'Pin the bots you use most and file the rest in folders. Each one shows whether it is working, waiting on you or has something new.',
      'Pick a bot and its chat opens beside the roster, with your choice of model and how hard it reasons.'
    ]
  },
  {
    view: 'details',
    preview: '/previews/details.jpg',
    wallpaper: '80% 20%',
    title: 'Each bot, its own way',
    paragraphs: [
      'Open a bot\u2019s details to set its title, description, model and look, and to write its SOUL: the few lines that say how it works.',
      'Routines give a bot a job on a schedule, such as a Monday cash report. The engine runs them even with Talyx closed.',
      'The models are your own. Add an API key, sign in with an account or point Talyx at a custom endpoint.'
    ]
  },
  {
    view: 'room',
    preview: '/previews/room.jpg',
    wallpaper: '40% 90%',
    title: 'Group rooms',
    paragraphs: [
      'Put several bots in one room and they answer in one conversation. You see who is answering and approve what they ask for.',
      'The engine hosts each room and keeps its history.'
    ]
  }
]

// Tailwind's `sm`. Narrower, the 980px demo shrinks to an unreadable third, so phones get the still.
const LIVE_DEMO_QUERY = '(min-width: 40rem)'

function subscribeToWidth(onChange: () => void) {
  const mq = window.matchMedia(LIVE_DEMO_QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

/** False in the prerender and on phones, so the iframe is never created there and never loads. */
function useLiveDemo() {
  return useSyncExternalStore(
    subscribeToWidth,
    () => window.matchMedia(LIVE_DEMO_QUERY).matches,
    () => false
  )
}

/** Each capability shown by the real app screen that does it, text hanging beside it. */
export function FeaturesSection() {
  const live = useLiveDemo()

  return (
    <section id="features" className="px-5 py-32 sm:px-8 md:py-48">
      <SectionHeading>What it does today.</SectionHeading>

      <div className="mt-16 space-y-24 md:space-y-32">
        {FEATURES.map(({ view, preview, wallpaper, title, paragraphs }) => (
          <article key={title} className="grid items-start gap-6 md:grid-cols-12 md:gap-8">
            <div
              data-reveal
              className="relative isolate overflow-hidden rounded-2xl p-4 md:col-span-7 md:p-8"
            >
              <Wallpaper objectPosition={wallpaper} loading="lazy" />
              {live ? (
                <AppEmbed view={view} width={980} height={640} title={`Talyx: ${title}`} />
              ) : (
                <img
                  src={preview}
                  alt={`Talyx: ${title}`}
                  width={1100}
                  height={720}
                  loading="lazy"
                  className="w-full rounded-xl"
                />
              )}
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
