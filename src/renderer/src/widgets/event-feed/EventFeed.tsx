import type { OfficeSnapshot } from '../../../../shared/office'

const SHOWN = 3

export function EventFeed({ snapshot }: { snapshot: OfficeSnapshot }): React.JSX.Element | null {
  const lines = snapshot.feed.slice(0, SHOWN)
  if (lines.length === 0) return null
  const names = new Map(snapshot.bots.map((b) => [b.id, b.name]))
  return (
    <section
      aria-label="Recent activity"
      className="absolute bottom-4 left-5 z-10 w-[340px] rounded-lg border border-[#2e2e2e] bg-[#111] px-3 py-1"
    >
      {lines.map((line) => (
        <div
          key={`${line.botId}-${line.at}`}
          className="border-t border-[#1a1a1a] py-1.5 text-xs text-[#b4b4b4] first:border-t-0"
        >
          <b className="font-medium text-white">{names.get(line.botId) ?? line.botId}</b>{' '}
          {line.text}
        </div>
      ))}
    </section>
  )
}
