import { Card, CardContent, CardHeader, CardTitle } from '@shared/ui/card'

export const inputClass =
  'h-8 w-full rounded-md border border-[#444] bg-black px-2 text-[13px] text-white outline-none focus:border-white disabled:opacity-50'

// The app has no .dark root, so the shadcn tokens are the light ones: colour explicitly.
export const primaryClass = 'bg-white text-black hover:bg-[#e5e5e5]'
export const outlineClass =
  'border border-[#444] bg-transparent text-white hover:bg-[#1a1a1a] hover:text-white'

export function Section({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Card className="gap-4 border-[#2e2e2e] bg-[#0b0b0b] py-5 text-white">
      <CardHeader className="px-5">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-5">{children}</CardContent>
    </Card>
  )
}

export function Field({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1 text-xs text-[#949494]">
      {label}
      {children}
    </label>
  )
}
