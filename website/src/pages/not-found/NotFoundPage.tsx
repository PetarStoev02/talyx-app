import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

function ScatteredFilesAnimation() {
  return (
    <svg
      viewBox="0 0 400 300"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="mx-auto w-full max-w-[400px]"
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

export function NotFoundPage() {
  return (
    <div className="relative flex flex-1 items-center justify-center px-4 py-24 sm:px-6">
      {/* Grid background */}
      <div className="page-grid pointer-events-none absolute inset-0" />

      <div className="relative text-center">
        <ScatteredFilesAnimation />

        <h1 className="mt-6 text-[80px] font-bold leading-none tracking-[-0.04em] text-[var(--color-text-primary)] sm:text-[120px]">
          404
        </h1>
        <p className="mt-3 text-lg text-[var(--color-text-secondary)] sm:text-xl">
          This page could not be found.
        </p>

        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full bg-[var(--color-btn-primary-bg)] px-6 py-2.5 text-sm font-semibold text-[var(--color-btn-primary-text)] transition-all hover:-translate-y-px hover:shadow-[0_4px_20px_var(--color-btn-primary-hover-shadow)]"
          >
            <ArrowLeft className="size-4" />
            Go Home
          </Link>
        </div>
      </div>
    </div>
  )
}
