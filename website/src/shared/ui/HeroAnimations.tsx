function Shell({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 480 120"
      fill="none"
      className="mx-auto w-full max-w-[480px]"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

// ─── Feature Page Animations ─────────────────────────────

/** AI Classification — 3-stage pipeline with sequential pulses */
export function AiClassificationAnim() {
  const xs = [60, 150, 240, 330, 420]
  const labels = ['Ext', 'Meta', 'Content', 'Name', 'Semantic']
  return (
    <Shell>
      {xs.map((x, i) => (
        <g key={i}>
          <circle
            cx={x}
            cy={50}
            r={14}
            stroke="var(--color-border)"
            strokeWidth="1.5"
            fill="var(--color-bg)"
          />
          <circle
            cx={x}
            cy={50}
            r={14}
            stroke="var(--color-text-tertiary)"
            strokeWidth="1"
            fill="none"
            className="sort-pulse"
            style={{ animationDelay: `${i * 0.6}s` }}
          />
          <circle cx={x} cy={50} r={3} fill="var(--color-text-tertiary)" opacity="0.5" />
          {i < 4 && (
            <line
              x1={x + 14}
              y1={50}
              x2={xs[i + 1] - 14}
              y2={50}
              stroke="var(--color-border)"
              strokeWidth="1"
              strokeDasharray="4 4"
              className="sort-flow"
              style={{ animationDelay: `${i * 0.3}s` }}
            />
          )}
        </g>
      ))}
      {labels.map((label, i) => (
        <text
          key={label}
          x={xs[i]}
          y={78}
          textAnchor="middle"
          fontSize="7"
          fill="var(--color-text-tertiary)"
          fontFamily="var(--font-sans)"
        >
          {label}
        </text>
      ))}
    </Shell>
  )
}

/** Watch Folders — radar sweep with detected file dots */
export function WatchFoldersAnim() {
  return (
    <Shell>
      <circle
        cx={240}
        cy={52}
        r={38}
        stroke="var(--color-border)"
        strokeWidth="1.5"
        fill="var(--color-bg)"
      />
      <circle
        cx={240}
        cy={52}
        r={24}
        stroke="var(--color-border)"
        strokeWidth="0.5"
        fill="none"
        opacity="0.3"
      />
      <circle
        cx={240}
        cy={52}
        r={10}
        stroke="var(--color-border)"
        strokeWidth="0.5"
        fill="none"
        opacity="0.3"
      />
      {/* Sweep line — SVG native animation for reliable rotation */}
      <g>
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 240 52"
          to="360 240 52"
          dur="5s"
          repeatCount="indefinite"
        />
        <line
          x1={240}
          y1={52}
          x2={240}
          y2={14}
          stroke="var(--color-text-tertiary)"
          strokeWidth="1.5"
          opacity="0.5"
          strokeLinecap="round"
        />
      </g>
      <circle cx={240} cy={52} r={3} fill="var(--color-text-tertiary)" />
      {/* Detected file dots */}
      <circle cx={257} cy={38} r={2.5} fill="var(--color-text-tertiary)" className="sort-sparkle" />
      <circle
        cx={226}
        cy={66}
        r={2.5}
        fill="var(--color-text-tertiary)"
        className="sort-sparkle"
        style={{ animationDelay: '2s' }}
      />
      <circle
        cx={252}
        cy={64}
        r={2.5}
        fill="var(--color-text-tertiary)"
        className="sort-sparkle"
        style={{ animationDelay: '4s' }}
      />
      <text
        x={240}
        y={102}
        textAnchor="middle"
        fontSize="8"
        fill="var(--color-text-tertiary)"
        fontFamily="var(--font-sans)"
      >
        Monitoring
      </text>
    </Shell>
  )
}

/** Smart Rename — before/after file name transformation */
export function SmartRenameAnim() {
  return (
    <Shell>
      {/* Before file */}
      <rect
        x={50}
        y={30}
        width={130}
        height={40}
        rx={8}
        stroke="var(--color-border)"
        strokeWidth="1.5"
        fill="var(--color-bg)"
      />
      <text
        x={115}
        y={54}
        textAnchor="middle"
        fontSize="10"
        fill="var(--color-text-tertiary)"
        fontFamily="var(--font-sans)"
      >
        IMG_4032.jpg
      </text>
      {/* Arrow with sparkle */}
      <line
        x1={195}
        y1={50}
        x2={275}
        y2={50}
        stroke="var(--color-border)"
        strokeWidth="1"
        strokeDasharray="4 4"
        className="sort-flow"
      />
      <path
        d="M235 40 L237 47 L244 49 L237 51 L235 58 L233 51 L226 49 L233 47 Z"
        fill="var(--color-text-tertiary)"
        className="sort-sparkle"
      />
      {/* After file */}
      <rect
        x={290}
        y={30}
        width={150}
        height={40}
        rx={8}
        stroke="var(--color-border)"
        strokeWidth="1.5"
        fill="var(--color-bg)"
      />
      <text
        x={365}
        y={54}
        textAnchor="middle"
        fontSize="10"
        fill="var(--color-text-tertiary)"
        fontFamily="var(--font-sans)"
      >
        sunset-photo.jpg
      </text>
      {/* Blinking cursor */}
      <line
        x1={420}
        y1={40}
        x2={420}
        y2={58}
        stroke="var(--color-text-tertiary)"
        strokeWidth="1.5"
        className="hero-blink"
      />
    </Shell>
  )
}

/** Sort History — timeline with undo arrow */
export function SortHistoryAnim() {
  const dots = [100, 190, 280, 370]
  return (
    <Shell>
      {/* Timeline line */}
      <line x1={70} y1={50} x2={400} y2={50} stroke="var(--color-border)" strokeWidth="1.5" />
      {/* Timeline dots */}
      {dots.map((x, i) => (
        <g key={i}>
          <circle
            cx={x}
            cy={50}
            r={8}
            stroke="var(--color-border)"
            strokeWidth="1.5"
            fill="var(--color-bg)"
          />
          <circle
            cx={x}
            cy={50}
            r={3}
            fill="var(--color-text-tertiary)"
            className="sort-sparkle"
            style={{ animationDelay: `${i * 0.8}s` }}
          />
        </g>
      ))}
      {/* Undo arc from dot 4 → dot 2 */}
      <path
        d="M 365 38 C 350 8, 210 8, 195 38"
        stroke="var(--color-text-tertiary)"
        strokeWidth="1.5"
        fill="none"
        strokeDasharray="4 4"
        className="sort-flow"
        style={{ animationDelay: '2s' }}
      />
      {/* Arrow head */}
      <path
        d="M 198 36 L 190 28 M 198 36 L 206 30"
        stroke="var(--color-text-tertiary)"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Labels */}
      {['Sort 1', 'Sort 2', 'Sort 3', 'Sort 4'].map((label, i) => (
        <text
          key={label}
          x={dots[i]}
          y={74}
          textAnchor="middle"
          fontSize="7"
          fill="var(--color-text-tertiary)"
          fontFamily="var(--font-sans)"
        >
          {label}
        </text>
      ))}
    </Shell>
  )
}

/** Drag & Drop — card lifting and moving to target */
export function DragDropAnim() {
  return (
    <Shell>
      {/* Source zone (dashed outline) */}
      <rect
        x={90}
        y={25}
        width={80}
        height={55}
        rx={8}
        stroke="var(--color-border)"
        strokeWidth="1.5"
        fill="none"
        strokeDasharray="6 3"
      />
      {/* Target zone */}
      <rect
        x={300}
        y={25}
        width={80}
        height={55}
        rx={8}
        stroke="var(--color-border)"
        strokeWidth="1.5"
        fill="var(--color-bg)"
        className="sort-sparkle"
      />
      {/* Arrow */}
      <path
        d="M 185 52 L 285 52"
        stroke="var(--color-border)"
        strokeWidth="1"
        strokeDasharray="4 4"
        className="sort-flow"
      />
      <path
        d="M 280 47 L 290 52 L 280 57"
        stroke="var(--color-border)"
        strokeWidth="1"
        fill="none"
      />
      {/* Moving card */}
      <g className="hero-move">
        <rect
          x={95}
          y={28}
          width={70}
          height={49}
          rx={6}
          stroke="var(--color-border)"
          strokeWidth="1.5"
          fill="var(--color-bg)"
        />
        <rect
          x={105}
          y={40}
          width={30}
          height={3}
          rx={1.5}
          fill="var(--color-text-tertiary)"
          opacity="0.4"
        />
        <rect
          x={105}
          y={50}
          width={45}
          height={3}
          rx={1.5}
          fill="var(--color-text-tertiary)"
          opacity="0.3"
        />
        <rect
          x={105}
          y={60}
          width={20}
          height={3}
          rx={1.5}
          fill="var(--color-text-tertiary)"
          opacity="0.2"
        />
      </g>
      {/* Labels */}
      <text
        x={130}
        y={98}
        textAnchor="middle"
        fontSize="7"
        fill="var(--color-text-tertiary)"
        fontFamily="var(--font-sans)"
      >
        Source
      </text>
      <text
        x={340}
        y={98}
        textAnchor="middle"
        fontSize="7"
        fill="var(--color-text-tertiary)"
        fontFamily="var(--font-sans)"
      >
        Sorted
      </text>
    </Shell>
  )
}

/** Privacy & Offline — shield with lock, blocked cloud */
export function PrivacyOfflineAnim() {
  return (
    <Shell>
      {/* Shield */}
      <path
        d="M240 8 L282 24 L282 62 Q282 90 240 100 Q198 90 198 62 L198 24 Z"
        stroke="var(--color-border)"
        strokeWidth="1.5"
        fill="var(--color-bg)"
      />
      <path
        d="M240 8 L282 24 L282 62 Q282 90 240 100 Q198 90 198 62 L198 24 Z"
        stroke="var(--color-text-tertiary)"
        strokeWidth="1"
        fill="none"
        className="sort-pulse"
        style={{ transformOrigin: '240px 54px' }}
      />
      {/* Lock body */}
      <rect
        x={228}
        y={48}
        width={24}
        height={18}
        rx={4}
        stroke="var(--color-text-tertiary)"
        strokeWidth="1.5"
        fill="none"
      />
      {/* Lock shackle */}
      <path
        d="M233 48 L233 40 Q233 32 240 32 Q247 32 247 40 L247 48"
        stroke="var(--color-text-tertiary)"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx={240} cy={57} r={2} fill="var(--color-text-tertiary)" />
      {/* Blocked cloud */}
      <g opacity="0.25">
        <path
          d="M375 38 Q375 28 385 28 Q395 22 405 28 Q415 28 415 38 Q420 38 420 46 Q420 54 410 54 L380 54 Q370 54 370 46 Q370 38 375 38 Z"
          stroke="var(--color-text-tertiary)"
          strokeWidth="1"
          fill="none"
        />
        <line
          x1={378}
          y1={30}
          x2={414}
          y2={54}
          stroke="var(--color-text-tertiary)"
          strokeWidth="1.5"
        />
      </g>
      {/* Blocked connection */}
      <line
        x1={286}
        y1={50}
        x2={365}
        y2={45}
        stroke="var(--color-border)"
        strokeWidth="1"
        strokeDasharray="4 4"
        opacity="0.2"
      />
      <text
        x={325}
        y={38}
        textAnchor="middle"
        fontSize="6"
        fill="var(--color-text-tertiary)"
        opacity="0.4"
        fontFamily="var(--font-sans)"
      >
        blocked
      </text>
    </Shell>
  )
}

/** Quick Search — search bar with radiating result lines */
export function QuickSearchAnim() {
  return (
    <Shell>
      {/* Search bar */}
      <rect
        x={120}
        y={20}
        width={240}
        height={36}
        rx={18}
        stroke="var(--color-border)"
        strokeWidth="1.5"
        fill="var(--color-bg)"
      />
      {/* Magnifying glass icon */}
      <circle
        cx={148}
        cy={38}
        r={7}
        stroke="var(--color-text-tertiary)"
        strokeWidth="1.5"
        fill="none"
      />
      <line
        x1={153}
        y1={43}
        x2={158}
        y2={48}
        stroke="var(--color-text-tertiary)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Query text */}
      <text
        x={170}
        y={42}
        fontSize="10"
        fill="var(--color-text-tertiary)"
        fontFamily="var(--font-sans)"
      >
        find invoices from March
      </text>
      {/* Blinking cursor */}
      <line
        x1={310}
        y1={28}
        x2={310}
        y2={48}
        stroke="var(--color-text-tertiary)"
        strokeWidth="1.5"
        className="hero-blink"
      />
      {/* Result rows */}
      {[68, 84, 100].map((y, i) => (
        <g key={i}>
          <rect
            x={140}
            y={y}
            width={200}
            height={12}
            rx={3}
            stroke="var(--color-border)"
            strokeWidth="1"
            fill="var(--color-bg)"
            className="sort-sparkle"
            style={{ animationDelay: `${0.4 + i * 0.3}s` }}
          />
          <rect
            x={146}
            y={y + 4}
            width={[80, 110, 60][i]}
            height={3}
            rx={1.5}
            fill="var(--color-text-tertiary)"
            opacity={0.3 - i * 0.05}
          />
        </g>
      ))}
      {/* Shortcut badge */}
      <text
        x={240}
        y={124}
        textAnchor="middle"
        fontSize="7"
        fill="var(--color-text-tertiary)"
        fontFamily="var(--font-sans)"
      >
        {'⌘ ⇧ Space'}
      </text>
    </Shell>
  )
}

// ─── Use Case Page Animations ────────────────────────────

/** Knowledge Workers — scattered docs → organized stacks */
export function KnowledgeWorkersAnim() {
  return (
    <Shell>
      {/* Scattered docs */}
      <g className="sort-bob">
        <rect
          x={55}
          y={15}
          width={30}
          height={38}
          rx={4}
          stroke="var(--color-border)"
          strokeWidth="1.5"
          fill="var(--color-bg)"
          transform="rotate(-8 70 34)"
        />
      </g>
      <g className="sort-bob" style={{ animationDelay: '0.8s' }}>
        <rect
          x={90}
          y={30}
          width={30}
          height={38}
          rx={4}
          stroke="var(--color-border)"
          strokeWidth="1.5"
          fill="var(--color-bg)"
          transform="rotate(5 105 49)"
        />
      </g>
      <g className="sort-bob" style={{ animationDelay: '1.6s' }}>
        <rect
          x={65}
          y={55}
          width={30}
          height={38}
          rx={4}
          stroke="var(--color-border)"
          strokeWidth="1.5"
          fill="var(--color-bg)"
          transform="rotate(-3 80 74)"
        />
      </g>
      {/* Flow arrow */}
      <path
        d="M 135 55 L 275 55"
        stroke="var(--color-border)"
        strokeWidth="1"
        strokeDasharray="4 4"
        className="sort-flow"
      />
      {/* Sparkle */}
      <path
        d="M205 45 L207 52 L214 54 L207 56 L205 63 L203 56 L196 54 L203 52 Z"
        fill="var(--color-text-tertiary)"
        className="sort-sparkle"
      />
      {/* Organized stacks */}
      <rect
        x={300}
        y={14}
        width={100}
        height={24}
        rx={6}
        stroke="var(--color-border)"
        strokeWidth="1.5"
        fill="var(--color-bg)"
      />
      <rect
        x={308}
        y={22}
        width={40}
        height={3}
        rx={1.5}
        fill="var(--color-text-tertiary)"
        opacity="0.3"
      />
      <rect
        x={300}
        y={44}
        width={100}
        height={24}
        rx={6}
        stroke="var(--color-border)"
        strokeWidth="1.5"
        fill="var(--color-bg)"
      />
      <rect
        x={308}
        y={52}
        width={55}
        height={3}
        rx={1.5}
        fill="var(--color-text-tertiary)"
        opacity="0.3"
      />
      <rect
        x={300}
        y={74}
        width={100}
        height={24}
        rx={6}
        stroke="var(--color-border)"
        strokeWidth="1.5"
        fill="var(--color-bg)"
      />
      <rect
        x={308}
        y={82}
        width={30}
        height={3}
        rx={1.5}
        fill="var(--color-text-tertiary)"
        opacity="0.3"
      />
    </Shell>
  )
}

/** Freelancers — different asset shapes flowing to labeled bins */
export function FreelancersAnim() {
  return (
    <Shell>
      {/* Assets */}
      <circle
        cx={75}
        cy={25}
        r={12}
        stroke="var(--color-border)"
        strokeWidth="1.5"
        fill="var(--color-bg)"
        className="sort-bob"
      />
      <rect
        x={60}
        y={48}
        width={24}
        height={24}
        rx={4}
        stroke="var(--color-border)"
        strokeWidth="1.5"
        fill="var(--color-bg)"
        className="sort-bob"
        style={{ animationDelay: '0.6s' }}
      />
      <polygon
        points="75,82 63,102 87,102"
        stroke="var(--color-border)"
        strokeWidth="1.5"
        fill="var(--color-bg)"
        strokeLinejoin="round"
        className="sort-bob"
        style={{ animationDelay: '1.2s' }}
      />
      {/* Flow paths */}
      <path
        d="M 87 25 C 170 25, 200 25, 300 25"
        stroke="var(--color-border)"
        strokeWidth="1"
        strokeDasharray="4 4"
        className="sort-flow"
      />
      <path
        d="M 84 60 C 170 60, 200 60, 300 60"
        stroke="var(--color-border)"
        strokeWidth="1"
        strokeDasharray="4 4"
        className="sort-flow"
        style={{ animationDelay: '0.5s' }}
      />
      <path
        d="M 87 92 C 170 92, 200 92, 300 92"
        stroke="var(--color-border)"
        strokeWidth="1"
        strokeDasharray="4 4"
        className="sort-flow"
        style={{ animationDelay: '1s' }}
      />
      {/* Category bins */}
      <rect
        x={310}
        y={14}
        width={80}
        height={22}
        rx={6}
        stroke="var(--color-border)"
        strokeWidth="1.5"
        fill="var(--color-bg)"
      />
      <text
        x={350}
        y={29}
        textAnchor="middle"
        fontSize="8"
        fill="var(--color-text-tertiary)"
        fontFamily="var(--font-sans)"
      >
        Photos
      </text>
      <rect
        x={310}
        y={49}
        width={80}
        height={22}
        rx={6}
        stroke="var(--color-border)"
        strokeWidth="1.5"
        fill="var(--color-bg)"
      />
      <text
        x={350}
        y={64}
        textAnchor="middle"
        fontSize="8"
        fill="var(--color-text-tertiary)"
        fontFamily="var(--font-sans)"
      >
        Contracts
      </text>
      <rect
        x={310}
        y={82}
        width={80}
        height={22}
        rx={6}
        stroke="var(--color-border)"
        strokeWidth="1.5"
        fill="var(--color-bg)"
      />
      <text
        x={350}
        y={97}
        textAnchor="middle"
        fontSize="8"
        fill="var(--color-text-tertiary)"
        fontFamily="var(--font-sans)"
      >
        Assets
      </text>
    </Shell>
  )
}

/** Students — paper pile to categorized groups */
export function StudentsAnim() {
  return (
    <Shell>
      {/* Paper stack */}
      <g className="sort-bob">
        <rect
          x={55}
          y={12}
          width={45}
          height={60}
          rx={4}
          stroke="var(--color-border)"
          strokeWidth="1.5"
          fill="var(--color-bg)"
          transform="rotate(-5 77 42)"
        />
        <rect
          x={63}
          y={22}
          width={22}
          height={3}
          rx={1.5}
          fill="var(--color-text-tertiary)"
          opacity="0.3"
        />
        <rect
          x={63}
          y={30}
          width={30}
          height={3}
          rx={1.5}
          fill="var(--color-text-tertiary)"
          opacity="0.2"
        />
      </g>
      <g className="sort-bob" style={{ animationDelay: '0.5s' }}>
        <rect
          x={70}
          y={18}
          width={45}
          height={60}
          rx={4}
          stroke="var(--color-border)"
          strokeWidth="1.5"
          fill="var(--color-bg)"
          transform="rotate(3 92 48)"
        />
        <rect
          x={78}
          y={28}
          width={25}
          height={3}
          rx={1.5}
          fill="var(--color-text-tertiary)"
          opacity="0.3"
        />
        <rect
          x={78}
          y={36}
          width={18}
          height={3}
          rx={1.5}
          fill="var(--color-text-tertiary)"
          opacity="0.2"
        />
      </g>
      {/* Arrow */}
      <path
        d="M 130 55 L 270 55"
        stroke="var(--color-border)"
        strokeWidth="1"
        strokeDasharray="4 4"
        className="sort-flow"
      />
      <path
        d="M200 45 L202 52 L209 54 L202 56 L200 63 L198 56 L191 54 L198 52 Z"
        fill="var(--color-text-tertiary)"
        className="sort-sparkle"
      />
      {/* Categories */}
      <rect
        x={290}
        y={12}
        width={100}
        height={26}
        rx={6}
        stroke="var(--color-border)"
        strokeWidth="1.5"
        fill="var(--color-bg)"
      />
      <text
        x={340}
        y={29}
        textAnchor="middle"
        fontSize="8"
        fill="var(--color-text-tertiary)"
        fontFamily="var(--font-sans)"
      >
        Research
      </text>
      <rect
        x={290}
        y={44}
        width={100}
        height={26}
        rx={6}
        stroke="var(--color-border)"
        strokeWidth="1.5"
        fill="var(--color-bg)"
      />
      <text
        x={340}
        y={61}
        textAnchor="middle"
        fontSize="8"
        fill="var(--color-text-tertiary)"
        fontFamily="var(--font-sans)"
      >
        Notes
      </text>
      <rect
        x={290}
        y={76}
        width={100}
        height={26}
        rx={6}
        stroke="var(--color-border)"
        strokeWidth="1.5"
        fill="var(--color-bg)"
      />
      <text
        x={340}
        y={93}
        textAnchor="middle"
        fontSize="8"
        fill="var(--color-text-tertiary)"
        fontFamily="var(--font-sans)"
      >
        Data
      </text>
    </Shell>
  )
}

/** Legal — documents secured inside a vault boundary */
export function LegalAnim() {
  return (
    <Shell>
      {/* Vault boundary */}
      <rect
        x={140}
        y={8}
        width={200}
        height={92}
        rx={12}
        stroke="var(--color-border)"
        strokeWidth="2"
        fill="var(--color-bg)"
      />
      <rect
        x={140}
        y={8}
        width={200}
        height={92}
        rx={12}
        stroke="var(--color-text-tertiary)"
        strokeWidth="1"
        fill="none"
        className="sort-pulse"
        style={{ transformOrigin: '240px 54px' }}
      />
      {/* Documents inside */}
      <rect
        x={168}
        y={28}
        width={36}
        height={46}
        rx={4}
        stroke="var(--color-border)"
        strokeWidth="1"
        fill="var(--color-bg)"
        className="sort-bob"
      />
      <rect
        x={175}
        y={38}
        width={18}
        height={2.5}
        rx={1}
        fill="var(--color-text-tertiary)"
        opacity="0.3"
      />
      <rect
        x={222}
        y={28}
        width={36}
        height={46}
        rx={4}
        stroke="var(--color-border)"
        strokeWidth="1"
        fill="var(--color-bg)"
        className="sort-bob"
        style={{ animationDelay: '0.5s' }}
      />
      <rect
        x={229}
        y={38}
        width={18}
        height={2.5}
        rx={1}
        fill="var(--color-text-tertiary)"
        opacity="0.3"
      />
      <rect
        x={276}
        y={28}
        width={36}
        height={46}
        rx={4}
        stroke="var(--color-border)"
        strokeWidth="1"
        fill="var(--color-bg)"
        className="sort-bob"
        style={{ animationDelay: '1s' }}
      />
      <rect
        x={283}
        y={38}
        width={18}
        height={2.5}
        rx={1}
        fill="var(--color-text-tertiary)"
        opacity="0.3"
      />
      {/* Lock badge */}
      <rect
        x={228}
        y={0}
        width={24}
        height={16}
        rx={4}
        fill="var(--color-bg)"
        stroke="var(--color-border)"
        strokeWidth="1.5"
      />
      <circle cx={240} cy={9} r={2.5} fill="var(--color-text-tertiary)" />
      {/* Label */}
      <text
        x={240}
        y={90}
        textAnchor="middle"
        fontSize="7"
        fill="var(--color-text-tertiary)"
        fontFamily="var(--font-sans)"
      >
        Local Only
      </text>
    </Shell>
  )
}

/** Medical — ECG heartbeat trace with secure processing label */
export function MedicalAnim() {
  return (
    <Shell>
      {/* Baseline */}
      <line
        x1={30}
        y1={50}
        x2={450}
        y2={50}
        stroke="var(--color-border)"
        strokeWidth="0.5"
        opacity="0.3"
      />
      {/* ECG trace */}
      <polyline
        points="30,50 90,50 110,50 118,25 126,75 134,38 142,55 150,50 210,50 228,50 236,25 244,75 252,38 260,55 268,50 330,50 348,50 356,25 364,75 372,38 380,55 388,50 450,50"
        stroke="var(--color-text-tertiary)"
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
        strokeDasharray="100 320"
        className="hero-trace"
      />
      {/* Heart icon */}
      <path
        d="M233 78 Q233 72 227 72 Q221 72 221 78 L227 88 L233 78 Z"
        fill="var(--color-text-tertiary)"
        opacity="0.4"
        className="sort-sparkle"
      />
      <text
        x={240}
        y={110}
        textAnchor="middle"
        fontSize="8"
        fill="var(--color-text-tertiary)"
        fontFamily="var(--font-sans)"
      >
        Secure Local Processing
      </text>
    </Shell>
  )
}
