import { Link } from '@tanstack/react-router'
import { GUTTER } from '@/shared/ui/page'

function ScatteredFilesAnimation() {
  return (
    <svg
      viewBox="0 0 400 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full max-w-[480px]"
      aria-hidden="true"
    >
      <defs>
        {/* Shared file shape — document with folded corner */}
        <clipPath id="file-clip">
          <path d="M4 0h40l16 16v60a4 4 0 01-4 4H4a4 4 0 01-4-4V4a4 4 0 014-4z" />
        </clipPath>
      </defs>

      {/* ── Folder (destination) — pulsing at center-bottom ── */}
      <g transform="translate(155, 190)">
        <animateTransform
          attributeName="transform"
          type="translate"
          values="155,190; 155,187; 155,190"
          dur="3s"
          repeatCount="indefinite"
        />
        {/* Folder back */}
        <rect
          x="0"
          y="8"
          width="90"
          height="60"
          rx="4"
          fill="var(--color-surface)"
          stroke="var(--color-border-hover)"
          strokeWidth="1.5"
        />
        {/* Folder tab */}
        <path d="M0 12a4 4 0 014-4h24l6 8H0z" fill="var(--color-border)" />
        {/* Folder front */}
        <rect
          x="0"
          y="16"
          width="90"
          height="52"
          rx="4"
          fill="var(--color-surface)"
          stroke="var(--color-border-hover)"
          strokeWidth="1.5"
        />
        {/* Talyx sorting lines icon inside folder */}
        <line
          x1="30"
          y1="32"
          x2="60"
          y2="32"
          stroke="var(--color-text-tertiary)"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.5"
        />
        <line
          x1="33"
          y1="40"
          x2="57"
          y2="40"
          stroke="var(--color-text-tertiary)"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.5"
        />
        <line
          x1="36"
          y1="48"
          x2="54"
          y2="48"
          stroke="var(--color-text-tertiary)"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.5"
        />
        <line
          x1="39"
          y1="56"
          x2="51"
          y2="56"
          stroke="var(--color-text-tertiary)"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.5"
        />
      </g>

      {/* ── File 1 — floats from top-left, drifts around ── */}
      <g opacity="0">
        <animateTransform
          attributeName="transform"
          type="translate"
          values="30,20; 50,40; 35,55; 30,20"
          dur="8s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0;0.9;0.9;0.9;0"
          dur="8s"
          repeatCount="indefinite"
        />
        <g transform="rotate(-15, 30, 40)">
          <rect
            x="0"
            y="0"
            width="60"
            height="80"
            rx="4"
            fill="var(--color-surface)"
            stroke="var(--color-border-hover)"
            strokeWidth="1.5"
          />
          {/* Folded corner */}
          <path
            d="M44 0v12a4 4 0 004 4h12"
            stroke="var(--color-border-hover)"
            strokeWidth="1.5"
            fill="var(--color-bg)"
          />
          <line
            x1="10"
            y1="24"
            x2="42"
            y2="24"
            stroke="var(--color-border)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line
            x1="10"
            y1="34"
            x2="36"
            y2="34"
            stroke="var(--color-border)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line
            x1="10"
            y1="44"
            x2="40"
            y2="44"
            stroke="var(--color-border)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line
            x1="10"
            y1="54"
            x2="30"
            y2="54"
            stroke="var(--color-border)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </g>
      </g>

      {/* ── File 2 — floats from top-right ── */}
      <g opacity="0">
        <animateTransform
          attributeName="transform"
          type="translate"
          values="280,10; 300,45; 275,60; 280,10"
          dur="9s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0;0.85;0.85;0.85;0"
          dur="9s"
          repeatCount="indefinite"
        />
        <g transform="rotate(10, 30, 40)">
          <rect
            x="0"
            y="0"
            width="60"
            height="80"
            rx="4"
            fill="var(--color-surface)"
            stroke="var(--color-border-hover)"
            strokeWidth="1.5"
          />
          <path
            d="M44 0v12a4 4 0 004 4h12"
            stroke="var(--color-border-hover)"
            strokeWidth="1.5"
            fill="var(--color-bg)"
          />
          <line
            x1="10"
            y1="24"
            x2="44"
            y2="24"
            stroke="var(--color-border)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line
            x1="10"
            y1="34"
            x2="38"
            y2="34"
            stroke="var(--color-border)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line
            x1="10"
            y1="44"
            x2="42"
            y2="44"
            stroke="var(--color-border)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </g>
      </g>

      {/* ── File 3 — center-top, drifts gently ── */}
      <g opacity="0">
        <animateTransform
          attributeName="transform"
          type="translate"
          values="160,5; 170,30; 150,45; 160,5"
          dur="7s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0;0.9;0.9;0.9;0"
          dur="7s"
          repeatCount="indefinite"
        />
        <g transform="rotate(-5, 30, 40)">
          <rect
            x="0"
            y="0"
            width="56"
            height="72"
            rx="4"
            fill="var(--color-surface)"
            stroke="var(--color-border-hover)"
            strokeWidth="1.5"
          />
          <path
            d="M40 0v12a4 4 0 004 4h12"
            stroke="var(--color-border-hover)"
            strokeWidth="1.5"
            fill="var(--color-bg)"
          />
          <line
            x1="10"
            y1="22"
            x2="38"
            y2="22"
            stroke="var(--color-border)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line
            x1="10"
            y1="32"
            x2="34"
            y2="32"
            stroke="var(--color-border)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line
            x1="10"
            y1="42"
            x2="30"
            y2="42"
            stroke="var(--color-border)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line
            x1="10"
            y1="52"
            x2="36"
            y2="52"
            stroke="var(--color-border)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </g>
      </g>

      {/* ── File 4 (small) — left side ── */}
      <g opacity="0">
        <animateTransform
          attributeName="transform"
          type="translate"
          values="80,100; 95,130; 70,140; 80,100"
          dur="10s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0;0.7;0.7;0.7;0"
          dur="10s"
          repeatCount="indefinite"
        />
        <g transform="rotate(8, 20, 30)">
          <rect
            x="0"
            y="0"
            width="48"
            height="62"
            rx="3"
            fill="var(--color-surface)"
            stroke="var(--color-border-hover)"
            strokeWidth="1.5"
          />
          <path
            d="M34 0v10a3 3 0 003 3h11"
            stroke="var(--color-border-hover)"
            strokeWidth="1.5"
            fill="var(--color-bg)"
          />
          <line
            x1="8"
            y1="20"
            x2="32"
            y2="20"
            stroke="var(--color-border)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line
            x1="8"
            y1="28"
            x2="28"
            y2="28"
            stroke="var(--color-border)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line
            x1="8"
            y1="36"
            x2="24"
            y2="36"
            stroke="var(--color-border)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </g>
      </g>

      {/* ── File 5 (small) — right side ── */}
      <g opacity="0">
        <animateTransform
          attributeName="transform"
          type="translate"
          values="260,110; 270,140; 250,150; 260,110"
          dur="11s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0;0.7;0.7;0.7;0"
          dur="11s"
          repeatCount="indefinite"
        />
        <g transform="rotate(-7, 20, 30)">
          <rect
            x="0"
            y="0"
            width="48"
            height="62"
            rx="3"
            fill="var(--color-surface)"
            stroke="var(--color-border-hover)"
            strokeWidth="1.5"
          />
          <path
            d="M34 0v10a3 3 0 003 3h11"
            stroke="var(--color-border-hover)"
            strokeWidth="1.5"
            fill="var(--color-bg)"
          />
          <line
            x1="8"
            y1="20"
            x2="34"
            y2="20"
            stroke="var(--color-border)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line
            x1="8"
            y1="28"
            x2="30"
            y2="28"
            stroke="var(--color-border)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line
            x1="8"
            y1="36"
            x2="26"
            y2="36"
            stroke="var(--color-border)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </g>
      </g>

      {/* ── Floating particles ── */}
      <circle cx="40" cy="170" r="2" fill="var(--color-border)" opacity="0">
        <animate attributeName="opacity" values="0;0.5;0" dur="4s" repeatCount="indefinite" />
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0,0; 5,-10; 0,0"
          dur="4s"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx="350" cy="130" r="2.5" fill="var(--color-border)" opacity="0">
        <animate attributeName="opacity" values="0;0.4;0" dur="5s" repeatCount="indefinite" />
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0,0; -8,-6; 0,0"
          dur="5s"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx="200" cy="15" r="1.5" fill="var(--color-border)" opacity="0">
        <animate attributeName="opacity" values="0;0.6;0" dur="3.5s" repeatCount="indefinite" />
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0,0; 3,8; 0,0"
          dur="3.5s"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx="120" cy="200" r="2" fill="var(--color-border)" opacity="0">
        <animate attributeName="opacity" values="0;0.3;0" dur="6s" repeatCount="indefinite" />
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0,0; 6,-4; 0,0"
          dur="6s"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx="310" cy="220" r="1.5" fill="var(--color-border)" opacity="0">
        <animate attributeName="opacity" values="0;0.5;0" dur="4.5s" repeatCount="indefinite" />
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0,0; -4,-8; 0,0"
          dur="4.5s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  )
}

const ELSEWHERE = [
  { to: '/blog', label: 'Read the blog' },
  { to: '/roadmap', label: 'See the roadmap' },
  { to: '/contact', label: 'Get in touch' }
] as const

export function NotFoundPage() {
  return (
    <section
      className={`${GUTTER} grid flex-1 items-center gap-16 pt-20 pb-32 md:grid-cols-12 md:pt-32 md:pb-48`}
    >
      <div className="md:col-span-7">
        <h1
          className="leading-[0.98] font-semibold tracking-[-0.045em] text-[var(--color-text-primary)]"
          style={{ fontSize: 'var(--step-display)' }}
        >
          <span data-reveal className="block">
            Page
          </span>
          <span data-reveal className="block" style={{ '--i': 1 } as React.CSSProperties}>
            not found
          </span>
        </h1>
        <p
          data-reveal
          className="mt-10 max-w-[36ch] text-[var(--color-text-primary)]"
          style={{ '--i': 2, fontSize: 'var(--step-lead)' } as React.CSSProperties}
        >
          This page could not be found. The link may be old, or the address mistyped.
        </p>
        <Link
          to="/"
          data-reveal
          style={{ '--i': 3 } as React.CSSProperties}
          className="mt-10 inline-flex min-h-12 items-center rounded-full bg-[var(--color-text-primary)] px-7 text-[17px] font-semibold text-[var(--color-bg)] transition-transform duration-200 hover:-translate-y-0.5"
        >
          Go home
        </Link>
        <ul
          className="mt-10 flex flex-wrap gap-x-8 gap-y-3"
          style={{ fontSize: 'var(--step-body)' }}
        >
          {ELSEWHERE.map(({ to, label }, i) => (
            <li key={to} data-reveal style={{ '--i': i + 4 } as React.CSSProperties}>
              <Link
                to={to}
                className="font-medium text-[var(--color-text-primary)] underline underline-offset-4 transition-opacity hover:opacity-70"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div data-reveal style={{ '--i': 2 } as React.CSSProperties} className="md:col-span-5">
        <ScatteredFilesAnimation />
      </div>
    </section>
  )
}
