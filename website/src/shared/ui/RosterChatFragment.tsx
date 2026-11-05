import { ArrowUp, CornerDownRight } from 'lucide-react'
import { BlockAvatar, type BlockState } from '@renderer/shared/ui/BlockAvatar'
import { lookOf } from '@features/bots/look'
import type { BotMeta } from '@features/bots/types'

// The live demo's roster and its Q3 margins exchange (tests/fixtures/roster), drawn statically so
// the prerendered page and the hydrated one match. Looks come from the app's own rules.

interface Pin {
  name: string
  title: string
  status: string
  state: BlockState
  marked?: boolean
}

interface Row {
  name: string
  title: string
  time: string
  preview: string
  meta?: BotMeta
  marked?: boolean
}

const PINS: Pin[] = [
  { name: 'default', title: 'Talyx', status: 'Ready', state: 'idle' },
  { name: 'researcher', title: 'Researcher', status: 'Working', state: 'working' },
  { name: 'analyst', title: 'Analyst', status: 'Waiting on you', state: 'waiting', marked: true }
]

const ROWS: Row[] = [
  {
    name: 'designer',
    title: 'Designer',
    time: '4m',
    preview: 'Two landing page layouts are ready to compare.',
    meta: { shape: 'blobatar:fixture1', color: 'hsl(150 68% 58%)' }
  },
  {
    name: 'writer',
    title: 'Writer',
    time: '6m',
    preview: 'The launch post is ready for your edits.',
    meta: { shape: 'tower', color: 2, faces: false },
    marked: true
  },
  {
    name: 'planner',
    title: 'Planner',
    time: '8m',
    preview: 'The Q4 plan has three milestones and two open risks.'
  }
]

const MARK = 'size-2 shrink-0 rounded-full bg-[oklch(0.6_0.15_285)]'

function Avatar({
  name,
  meta = {},
  size,
  state
}: {
  name: string
  meta?: BotMeta
  size: number
  state?: BlockState
}) {
  if (name === 'default') return <BlockAvatar shape="talyx" hue={0} size={size} state={state} />
  const { shape, hue, faces } = lookOf({ name, meta })
  return <BlockAvatar shape={shape} hue={hue} size={size} state={state} face={faces} />
}

/** The app's main screen in the site's kit: the roster, and Talyx briefing you after asking Analyst. */
export function RosterChatFragment({ className = '' }: { className?: string }) {
  return (
    <div
      data-ui
      role="img"
      aria-label="Talyx with a roster of bots on the left and, on the right, a chat in which Talyx asks Analyst how Q3 margins did and briefs you."
      className={`flex flex-col overflow-hidden rounded-xl bg-background text-left text-[14px] leading-snug text-foreground sm:flex-row ${className}`}
    >
      <aside className="shrink-0 bg-sidebar p-3 sm:w-[40%] sm:max-w-[340px] sm:p-4">
        <div className="flex items-center gap-2 px-1 font-semibold">
          <BlockAvatar shape="talyx" hue={0} size={18} face={false} />
          Talyx
        </div>
        <ul className="mt-4 grid grid-cols-3 gap-2">
          {PINS.map((pin, i) => (
            <li
              key={pin.name}
              className={`flex min-w-0 flex-col items-center rounded-xl px-1 pt-4 pb-2.5 text-center ${
                i === 0 ? 'bg-foreground/10' : 'bg-secondary'
              }`}
            >
              <Avatar name={pin.name} size={40} state={pin.state} />
              <span className="mt-2 w-full truncate font-medium">{pin.title}</span>
              <span className="w-full truncate text-[12px] text-muted-foreground">
                {pin.status}
              </span>
              <span className={`${MARK} mt-1.5 ${pin.marked ? '' : 'invisible'}`} />
            </li>
          ))}
        </ul>
        <div className="mt-5 hidden sm:block">
          <p className="flex justify-between px-1 text-[13px] text-muted-foreground">
            <span>Team</span>
            <span>{ROWS.length}</span>
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {ROWS.map((row) => (
              <li key={row.name} className="flex items-center gap-2.5 rounded-xl px-1 py-1.5">
                <Avatar name={row.name} meta={row.meta} size={24} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="truncate font-medium">{row.title}</span>
                    <span className="ml-auto shrink-0 text-[12px] text-muted-foreground">
                      {row.time}
                    </span>
                  </span>
                  <span className="block truncate text-[13px] text-muted-foreground">
                    {row.preview}
                  </span>
                </span>
                <span className={`${MARK} ${row.marked ? '' : 'invisible'}`} />
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col p-3 sm:p-5">
        <span className="mx-auto flex items-center gap-1.5 rounded-full bg-secondary py-1 pr-3.5 pl-2.5 font-medium">
          <BlockAvatar shape="talyx" hue={0} size={16} face={false} />
          Talyx
        </span>
        <div className="mt-4 flex flex-1 flex-col gap-3">
          <p className="max-w-[80%] self-end rounded-2xl bg-secondary px-3.5 py-2">
            How did Q3 margins do?
          </p>
          <p className="flex items-center gap-1 text-[13px] text-muted-foreground">
            <CornerDownRight aria-hidden="true" className="size-3.5" />
            Asked Analyst
          </p>
          <div className="max-w-[88%] rounded-2xl bg-secondary px-3.5 py-2.5">
            <p>
              <strong className="font-semibold">Q3 margins are up 4 points</strong>, to 41%.
            </p>
            <ul className="mt-1.5 list-disc pl-5">
              <li>Costs held flat</li>
              <li>The September price change did the rest</li>
            </ul>
            <p className="mt-1.5">Analyst can split it by region next.</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-2xl bg-secondary py-2 pr-2 pl-4 text-muted-foreground">
          Message Talyx
          <span className="grid size-7 place-items-center rounded-full bg-foreground text-background">
            <ArrowUp aria-hidden="true" className="size-4" />
          </span>
        </div>
      </section>
    </div>
  )
}
