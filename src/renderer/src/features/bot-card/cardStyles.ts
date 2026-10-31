import { cn } from '@shared/lib/utils'

export const cardButton =
  'mt-3 mr-1.5 h-[30px] cursor-pointer rounded-md border border-[#444] bg-transparent px-3 text-[13px] text-white hover:border-[#b4b4b4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-default disabled:opacity-50'

export const primaryButton = cn(cardButton, 'border-white bg-white text-black hover:border-white')

export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}
