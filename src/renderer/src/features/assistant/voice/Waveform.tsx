const BARS = [0.45, 0.8, 1, 0.8, 0.45]

/** Five bars breathing with one level value — enough to show Talyx is hearing you. */
export function Waveform({ level }: { level: number }): React.JSX.Element {
  return (
    <div className="flex h-5 items-center gap-1" aria-hidden>
      {BARS.map((weight, index) => (
        <span
          key={index}
          className="w-1 rounded-full bg-primary transition-[height] duration-75"
          style={{ height: `${Math.max(3, weight * level * 20)}px` }}
        />
      ))}
    </div>
  )
}
