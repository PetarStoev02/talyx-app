/**
 * Two illustrations the feature pages did not already have, drawn in the same
 * 480×120 line style as `shared/ui/HeroAnimations` so the grid reads as one set.
 */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 480 120" fill="none" className="mx-auto w-full" aria-hidden="true">
      {children}
    </svg>
  )
}

/**
 * The shared 480×120 illustrations are drawn for a wide hero strip; in a narrow
 * card their subject is a small cluster in the middle. Scale up from the top
 * centre and crop the empty sides so the subject fills the card.
 */
export function Zoom({ scale, children }: { scale: number; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden" style={{ aspectRatio: `4 / ${scale}` }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}>{children}</div>
    </div>
  )
}

const CHIPS = ['capture', 'recall', 'triage', 'watch', 'act', 'focus']

/** Abilities — one hotkey, then the six day jobs light up in turn. */
export function AbilitiesAnim() {
  const chipWidth = 58
  const gap = 10
  const rowWidth = CHIPS.length * chipWidth + (CHIPS.length - 1) * gap
  const startX = (480 - rowWidth) / 2
  return (
    <Shell>
      {/* Hotkey pill */}
      <rect
        x={200}
        y={12}
        width={80}
        height={22}
        rx={11}
        stroke="var(--color-border)"
        strokeWidth="1.5"
        fill="var(--color-bg)"
      />
      <text
        x={240}
        y={27}
        textAnchor="middle"
        fontSize="9"
        fill="var(--color-text-secondary)"
        fontFamily="var(--font-sans)"
      >
        ⌘⇧Space
      </text>
      {/* Fan-out lines from the pill to each chip */}
      {CHIPS.map((_, i) => {
        const cx = startX + i * (chipWidth + gap) + chipWidth / 2
        return (
          <path
            key={i}
            d={`M 240 34 C 240 56, ${cx} 52, ${cx} 74`}
            stroke="var(--color-border)"
            strokeWidth="1"
            strokeDasharray="4 4"
            className="sort-flow"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        )
      })}
      {/* Chips */}
      {CHIPS.map((label, i) => {
        const x = startX + i * (chipWidth + gap)
        return (
          <g key={label} className="feat-appear" style={{ animationDelay: `${i * 0.5}s` }}>
            <rect
              x={x}
              y={74}
              width={chipWidth}
              height={24}
              rx={8}
              stroke="var(--color-border)"
              strokeWidth="1.5"
              fill="var(--color-bg)"
            />
            <text
              x={x + chipWidth / 2}
              y={90}
              textAnchor="middle"
              fontSize="8"
              fill="var(--color-text-secondary)"
              fontFamily="var(--font-sans)"
            >
              {label}
            </text>
          </g>
        )
      })}
    </Shell>
  )
}

/** Approval — a card names the change; nothing moves until Approve is pressed. */
export function ApprovalAnim() {
  return (
    <Shell>
      {/* Card */}
      <rect
        x={110}
        y={14}
        width={260}
        height={92}
        rx={12}
        stroke="var(--color-border)"
        strokeWidth="1.5"
        fill="var(--color-bg)"
      />
      {/* Title line + two operation rows */}
      <rect
        x={128}
        y={30}
        width={120}
        height={6}
        rx={3}
        fill="var(--color-text-secondary)"
        opacity="0.7"
      />
      <rect x={128} y={46} width={190} height={4} rx={2} fill="var(--color-border)" />
      <rect x={128} y={56} width={150} height={4} rx={2} fill="var(--color-border)" />
      {/* Deny */}
      <text
        x={262}
        y={90}
        textAnchor="middle"
        fontSize="8"
        fill="var(--color-text-tertiary)"
        fontFamily="var(--font-sans)"
      >
        Deny
      </text>
      {/* Approve button with a pulse ring */}
      <rect
        x={286}
        y={76}
        width={66}
        height={20}
        rx={10}
        stroke="var(--color-text-tertiary)"
        strokeWidth="1"
        fill="none"
        className="sort-pulse"
        style={{ transformOrigin: '319px 86px' }}
      />
      <rect x={286} y={76} width={66} height={20} rx={10} fill="var(--color-text-primary)" />
      <text
        x={319}
        y={89.5}
        textAnchor="middle"
        fontSize="8"
        fontWeight="600"
        fill="var(--color-bg)"
        fontFamily="var(--font-sans)"
      >
        Approve ↵
      </text>
      {/* Check that draws itself once the button is pressed */}
      <path
        d="M 132 86 L 139 93 L 152 78"
        stroke="var(--color-text-primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="feat-draw"
      />
    </Shell>
  )
}
