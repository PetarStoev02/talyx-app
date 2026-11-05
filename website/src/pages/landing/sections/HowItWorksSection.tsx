import { STEP } from '../../../shared/ui/page'

const STAGES = [
  {
    line: 'First, add a bot.',
    note: 'Click + in the roster, name it, say what it does and pick its look. Folders and pins keep a long roster short.'
  },
  {
    line: 'Then talk to it.',
    note: 'Each bot has its own chat, with images and dictation. When it needs your approval or an answer, it asks with a card.'
  },
  {
    line: 'Let Talyx delegate.',
    note: 'Ask Talyx, the manager bot, and it passes the work to the bot that fits.'
  },
  {
    line: 'Read the brief.',
    note: 'Talyx collects the replies and sums them up for you in a few lines.'
  }
]

/** The ritual, written as a staircase: each stage steps further right. */
export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="px-5 py-32 sm:px-8 md:py-48">
      <ol className="space-y-10 md:space-y-14">
        {STAGES.map(({ line, note }, i) => {
          const Line = i === 0 ? 'h2' : 'p'
          return (
            <li
              key={line}
              data-reveal
              style={{ '--step': i } as React.CSSProperties}
              className="ml-[calc(var(--step)*6vw)] md:ml-[calc(var(--step)*12%)]"
            >
              <Line
                className="leading-none font-semibold tracking-[-0.035em] text-[var(--color-text-primary)]"
                style={STEP.heading}
              >
                {line}
              </Line>
              <p className="mt-4 max-w-[38ch] text-[var(--color-text-primary)]" style={STEP.body}>
                {note}
              </p>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
