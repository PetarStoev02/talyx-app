import { cn } from '@shared/lib/utils'

interface StepperProps {
  total: number
  current: number
}

/** Dot-stepper for the onboarding gate's steps. */
export function Stepper({ total, current }: StepperProps): React.JSX.Element {
  return (
    <div className="flex justify-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 rounded-full transition-all duration-300',
            i === current
              ? 'w-6 bg-foreground'
              : i < current
                ? 'w-6 bg-foreground/40'
                : 'w-1.5 bg-muted-foreground/30'
          )}
        />
      ))}
    </div>
  )
}
