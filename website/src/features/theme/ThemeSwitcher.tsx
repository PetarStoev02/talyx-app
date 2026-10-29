import { type Theme } from './useTheme'
import { Monitor, Sun, Moon } from 'lucide-react'

export function ThemeSwitcher({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }) {
  const options: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: 'system', label: 'System', icon: <Monitor className="size-4" /> },
    { value: 'light', label: 'Light', icon: <Sun className="size-4" /> },
    { value: 'dark', label: 'Dark', icon: <Moon className="size-4" /> }
  ]

  return (
    <div className="inline-flex items-center overflow-hidden rounded-full bg-[var(--color-bg-secondary)] p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          className={`flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors ${
            theme === opt.value
              ? 'bg-[var(--color-fg)] text-[var(--color-bg)]'
              : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
          }`}
          aria-label={opt.label}
        >
          {opt.icon}
          <span className="hidden sm:inline">{opt.label}</span>
        </button>
      ))}
    </div>
  )
}
