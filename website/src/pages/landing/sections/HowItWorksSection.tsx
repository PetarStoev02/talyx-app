const STAGES = [
  {
    line: 'First, press ⌘⇧Space.',
    note: 'Then say it in your own words, typed or spoken. Voice is transcribed on your Mac.'
  },
  {
    line: 'Then Claude plans it.',
    note: 'Your API key, or the Claude Code you are already signed into. Talyx hosts no model.'
  },
  {
    line: 'You read the card.',
    note: 'It names the exact change: which files, which event, which click. Reads run without asking.'
  },
  {
    line: 'Approve, and it runs.',
    note: 'Every batch of files can be undone in one click. ⌘⇧Esc stops it mid-run.'
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
                style={{ fontSize: 'var(--step-heading)' }}
              >
                {line}
              </Line>
              <p
                className="mt-4 max-w-[38ch] text-[var(--color-text-primary)]"
                style={{ fontSize: 'var(--step-body)' }}
              >
                {note}
              </p>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
